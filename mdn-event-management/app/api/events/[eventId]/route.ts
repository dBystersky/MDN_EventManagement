import { NextResponse } from "next/server";
import { validateEvent } from "@/lib/validation";
import { readEvent, deleteEvent, parseEventSubtasks, updateEvent } from "@/lib/events";
import { conflictsForEvent } from "@/lib/conflictQueries";
import { isBadRequest, validationFailed } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { forbidden, loadEventAccess, requireSession } from "@/lib/access";
import {
  canAssignEventMembers,
  canCreateEvent,
  canEditBudget,
  canModifyEvent,
  canViewEvent,
} from "@/lib/permissions";
import { changedFields, findAllocationDependents, recordAudit, recordCascade } from "@/lib/audit";

type RouteParams = {
  params: Promise<{ eventId: string }>;
};

// Functino to get individual event from the API
export async function GET(request: Request, context: RouteParams) {
  const auth = await requireSession();
  if (auth.denied) return auth.denied;

  // Extract the eventId from the URL parameters
  const { eventId } = await context.params;
  const id = Number(eventId);

  try {
    // Get the event from the database
    const event = await readEvent(id);
    if (event && !canViewEvent(auth.actor, event)) {
      return forbidden("you are not part of this event");
    }

    // Return the found event
    return NextResponse.json(event, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: `Event not found: ${error}` }, { status: 404 });
  }
}

export async function PATCH(request: Request, context: RouteParams) {
  const auth = await requireSession();
  if (auth.denied) return auth.denied;
  const { session, actor } = auth;

  // Extract the eventId from the URL parameters
  const { eventId } = await context.params;
  const id = Number(eventId);

  const access = await loadEventAccess(id);
  if (!access) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (!canModifyEvent(actor, access)) return forbidden("you do not manage this event");

  // Extract the params to update event with
  const body = await request.json();

  // Managers are chosen by executives; managers only assign members.
  if (body.managerIds !== undefined && !canCreateEvent(actor)) {
    return forbidden("only executives can change an event's managers");
  }
  if (body.memberIds !== undefined && !canAssignEventMembers(actor, access)) {
    return forbidden("you cannot assign people to this event");
  }
  // Pulling in a task that lives in another event would edit that event.
  if (Array.isArray(body.taskIds) && !canCreateEvent(actor)) {
    const foreign = await prisma.task.findMany({
      where: { taskId: { in: body.taskIds.map(Number) }, eventId: { notIn: [id], not: null } },
      select: { eventId: true },
    });
    for (const { eventId: otherId } of foreign) {
      const other = await loadEventAccess(otherId as number);
      if (!other || !canModifyEvent(actor, other)) {
        return forbidden("a task you are adding belongs to an event you do not manage");
      }
    }
  }
  if (
    !canEditBudget(actor) &&
    Array.isArray(body.subtasks) &&
    body.subtasks.some((t: { budget?: unknown }) => t?.budget != null)
  ) {
    return forbidden("only executives and managers can set budgets");
  }

  const invalid = validationFailed(validateEvent(body, { partial: true }));
  if (invalid) return invalid;

  try {
    const subtasks = parseEventSubtasks(body.subtasks);

    // Update the event
    const event = await updateEvent(id, {
      name: body.name,
      description: body.description,
      date: body.date !== undefined ? new Date(body.date) : undefined,
      endDate: body.endDate !== undefined ? new Date(body.endDate) : undefined,
      locationId: body.locationId !== undefined ? Number(body.locationId) : undefined,
      managerIds: Array.isArray(body.managerIds) ? body.managerIds.map(Number) : undefined,
      memberIds: Array.isArray(body.memberIds) ? body.memberIds.map(Number) : undefined,
      resourceIds: Array.isArray(body.resourceIds) ? body.resourceIds.map(Number) : undefined,
      taskIds: Array.isArray(body.taskIds) ? body.taskIds.map(Number) : undefined,
      subtasks,
    });

    const fields = changedFields(body);
    await recordAudit({
      actor: session,
      action: "update",
      entityType: "Event",
      entityId: event.eventId,
      summary: `Updated event "${event.name}"`,
      changes: { fields },
    });

    // Flag, never block — see POST /api/events.
    const conflicts = await conflictsForEvent(id);

    // Return the updated event
    return NextResponse.json({ ...event, conflicts }, { status: 200 });
  } catch (error) {
    if (isBadRequest(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: `Event not found: ${error}` }, { status: 404 });
      }
    }

    return NextResponse.json({ error: `Failed to update event: ${error}` }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteParams) {
  const auth = await requireSession();
  if (auth.denied) return auth.denied;
  const { session, actor } = auth;
  if (!canCreateEvent(actor)) return forbidden("only executives can delete events");

  const { eventId } = await context.params;
  const id = Number(eventId);

  try {
    const before = await readEvent(id);

    // Delete the event
    const allocations = before
      ? await findAllocationDependents({ bookableId: before.bookableId })
      : [];
    await deleteEvent(id);
    const because = `event #${id} was deleted`;
    await recordCascade(session, "delete", "ResourceAllocation", allocations, because);
    await recordCascade(
      session,
      "update",
      "Task",
      (before?.tasks ?? []).map((t) => ({
        id: t.taskId,
        label: `task "${t.name}" from the event`,
      })),
      because,
    );

    const label = before ? `"${before.name}"` : `#${id}`;
    await recordAudit({
      actor: session,
      action: "delete",
      entityType: "Event",
      entityId: id,
      summary: `Deleted event ${label}`,
    });

    // Return a success message
    return NextResponse.json({ message: "Event deleted successfully" }, { status: 200 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: `Event not found: ${error}` }, { status: 404 });
      }
    }
    return NextResponse.json({ error: `Failed to delete event ${error}` }, { status: 500 });
  }
}
