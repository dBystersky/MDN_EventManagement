import { NextResponse } from "next/server";
import { readEvent, deleteEvent, parseEventSubtasks, updateEvent } from "@/lib/events";
import { Prisma } from "@/generated/prisma/client";
import { getAuthSession, isGuest } from "@/lib/auth";
import { changedFields, findAllocationDependents, recordAudit, recordCascade } from "@/lib/audit";

type RouteParams = {
  params: Promise<{ eventId: string }>;
};

// Functino to get individual event from the API
export async function GET(request: Request, context: RouteParams) {
  if (isGuest(await getAuthSession())) {
    return NextResponse.json(
      { error: "Forbidden — guests have read-only calendar access" },
      { status: 403 },
    );
  }

  // Extract the eventId from the URL parameters
  const { eventId } = await context.params;
  const id = Number(eventId);

  try {
    // Get the event from the database
    const event = await readEvent(id);

    // Return the found event
    return NextResponse.json(event, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: `Event not found: ${error}` }, { status: 404 });
  }
}

export async function PATCH(request: Request, context: RouteParams) {
  const session = await getAuthSession();
  if (isGuest(session)) {
    return NextResponse.json(
      { error: "Forbidden — guests have read-only calendar access" },
      { status: 403 },
    );
  }

  // Extract the eventId from the URL parameters
  const { eventId } = await context.params;
  const id = Number(eventId);

  // Extract the params to update event with
  const body = await request.json();

  try {
    const subtasks = parseEventSubtasks(body.subtasks);

    // Update the event
    const event = await updateEvent(id, {
      name: body.name,
      description: body.description,
      date: body.date !== undefined ? new Date(body.date) : undefined,
      locationId: body.locationId !== undefined ? Number(body.locationId) : undefined,
      managerIds: Array.isArray(body.managerIds) ? body.managerIds.map(Number) : undefined,
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

    // Return the updated event
    return NextResponse.json(event, { status: 200 });
  } catch (error) {
    if (error instanceof Error && /subtasks/.test(error.message)) {
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
  const session = await getAuthSession();
  if (isGuest(session)) {
    return NextResponse.json(
      { error: "Forbidden — guests have read-only calendar access" },
      { status: 403 },
    );
  }

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
