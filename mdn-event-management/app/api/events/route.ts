import { NextResponse } from "next/server";
import { validateEvent } from "@/lib/validation";
import { createEvent, listEvents, parseEventSubtasks } from "@/lib/events";
import { conflictsForEvent } from "@/lib/conflictQueries";
import { isBadRequest, validationFailed } from "@/lib/api-errors";
import { Prisma } from "@/generated/prisma/client";

// Function to get all events from the API
export async function GET() {
  try {
    const events = await listEvents();
    return NextResponse.json(events, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: `Failed to get events: ${error}` }, { status: 500 });
  }
}

// Function to create a new event
export async function POST(request: Request) {
  const body = await request.json();

  const invalid = validationFailed(validateEvent(body));
  if (invalid) return invalid;

  try {
    const newEvent = await createEvent({
      name: body.name,
      description: body.description,
      date: new Date(body.date),
      endDate: new Date(body.endDate),
      locationId: Number(body.locationId),
      managerIds: Array.isArray(body.managerIds) ? body.managerIds.map(Number) : undefined,
      resourceIds: Array.isArray(body.resourceIds) ? body.resourceIds.map(Number) : undefined,
      taskIds: Array.isArray(body.taskIds) ? body.taskIds.map(Number) : undefined,
      subtasks: parseEventSubtasks(body.subtasks),
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
