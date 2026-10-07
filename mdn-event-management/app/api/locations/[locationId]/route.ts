import { NextResponse } from "next/server";
import { validationFailed } from "@/lib/api-errors";
import { validateNamed } from "@/lib/validation";
import { getAuthSession, isGuest } from "@/lib/auth";
import { recordAudit, recordCascade } from "@/lib/audit";
import { getLocation, updateLocation, deleteLocation } from "@/lib/locations";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{ locationId: string }>;
};

export async function GET(request: Request, context: RouteParams) {
  if (isGuest(await getAuthSession())) {
    return NextResponse.json(
      { error: "Forbidden — guests have read-only calendar access" },
      { status: 403 },
    );
  }

  // Extract the locationId from the URL parameters
  const { locationId } = await context.params;
  const id = Number(locationId);

  try {
    // Get the location from the database
    const event = await getLocation(id);

    // Return the found location
    return NextResponse.json(event, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: `Location not found: ${error}` }, { status: 404 });
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

  const { locationId } = await context.params;
  const id = Number(locationId);

  try {
    const body = await request.json();
    const { name } = body;

    const invalid = validationFailed(validateNamed(body, "location"));
    if (invalid) return invalid;

    const updatedLocation = await updateLocation(id, name);

    await recordAudit({
      actor: session,
      action: "update",
      entityType: "Location",
      entityId: id,
      changes: { fields: ["name"] },
      summary: `Renamed location to "${updatedLocation.name}"`,
    });
    return NextResponse.json(updatedLocation, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: `Failed to update location: ${error}` }, { status: 500 });
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

  const { locationId } = await context.params;
  const id = Number(locationId);

  try {
    const before = await getLocation(id);
    const events =
      (await prisma.event.findMany({
        where: { eventLocationId: id },
        select: { eventId: true, name: true },
      })) ?? [];
    await deleteLocation(id);
    await recordCascade(
      session,
      "delete",
      "Event",
      events.map((e) => ({ id: e.eventId, label: `event "${e.name}"` })),
      `location #${id} was deleted`,
    );
    await recordAudit({
      actor: session,
      action: "delete",
      entityType: "Location",
      entityId: id,
      summary: `Deleted location ${before ? `"${before.name}"` : `#${id}`}`,
    });
    return NextResponse.json({ message: "Location deleted successfully" }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: `Failed to delete location: ${error}` }, { status: 500 });
  }
}
