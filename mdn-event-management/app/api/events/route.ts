import { NextResponse } from "next/server";
import { createEvent, listEvents, parseEventSubtasks } from "@/lib/events";
import { Prisma } from "@/generated/prisma/client";
import { getAuthSession, isGuest } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

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
  const session = await getAuthSession();
  if (isGuest(session)) {
    return NextResponse.json(
      { error: "Forbidden — guests have read-only calendar access" },
      { status: 403 },
    );
  }

  const body = await request.json();

  try {
    const subtasks = parseEventSubtasks(body.subtasks);
    const newEvent = await createEvent({
      name: body.name,
      description: body.description,
      date: new Date(body.date),
      locationId: Number(body.locationId),
      managerIds: Array.isArray(body.managerIds) ? body.managerIds.map(Number) : undefined,
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

    return NextResponse.json(newEvent, { status: 201 });
  } catch (error) {
    console.error(error);
    if (error instanceof Error && /subtasks/.test(error.message)) {
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
