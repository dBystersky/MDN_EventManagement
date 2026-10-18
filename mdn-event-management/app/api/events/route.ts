import { NextResponse } from "next/server";
import { validateEvent } from "@/lib/validation";
import { createEvent, listEvents, parseEventSubtasks } from "@/lib/events";
import { conflictsForEvent } from "@/lib/conflictQueries";
import { isBadRequest, validationFailed } from "@/lib/api-errors";
import { Prisma } from "@/generated/prisma/client";
import { forbidden, requireSession } from "@/lib/access";
import { canCreateEvent, canEditBudget, isMember } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";

// Function to get all events from the API
export async function GET() {
  const auth = await requireSession();
  if (auth.denied) return auth.denied;

  try {
    // Members only ever see the events they belong to.
    const events = await listEvents(
      isMember(auth.actor) ? { memberId: auth.session.member_id } : undefined,
    );
    return NextResponse.json(events, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: `Failed to get events: ${error}` }, { status: 500 });
  }
}

// Function to create a new event
export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth.denied) return auth.denied;
  const { session, actor } = auth;
  if (!canCreateEvent(actor)) return forbidden("only executives can create events");

  const body = await request.json();
  if (
    !canEditBudget(actor) &&
    Array.isArray(body.subtasks) &&
    body.subtasks.some((t: { budget?: unknown }) => t?.budget != null)
  ) {
    return forbidden("only executives and managers can set budgets");
  }

  const invalid = validationFailed(validateEvent(body));
  if (invalid) return invalid;

  try {
    const subtasks = parseEventSubtasks(body.subtasks);
    const newEvent = await createEvent({
      name: body.name,
      description: body.description,
      date: new Date(body.date),
      endDate: new Date(body.endDate),
      locationId: Number(body.locationId),
      managerIds: Array.isArray(body.managerIds) ? body.managerIds.map(Number) : undefined,
      memberIds: Array.isArray(body.memberIds) ? body.memberIds.map(Number) : undefined,
      resourceIds: Array.isArray(body.resourceIds) ? body.resourceIds.map(Number) : undefined,
      taskIds: Array.isArray(body.taskIds) ? body.taskIds.map(Number) : undefined,
      subtasks,
    });

    await recordAudit({
      actor: session,
      action: "create",
      entityType: "Event",
      entityId: newEvent.eventId,
      summary: `Created event "${newEvent.name}"`,
    });

    // Clashes are flagged, never blocking: the event is created either way
    // and the caller is told what it now collides with (RTM Req 7).
    const conflicts = await conflictsForEvent(newEvent.eventId);

    return NextResponse.json({ ...newEvent, conflicts }, { status: 201 });
  } catch (error) {
    console.error(error);
    if (isBadRequest(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        {
          error: "Failed to create event",
          code: error.code,
          meta: error.meta,
          message: error.message,
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: `Failed to create event: ${error}` }, { status: 500 });
  }
}
