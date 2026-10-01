import { NextResponse } from "next/server";
import { getAuthSession, isGuest } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { createLocation, listLocations } from "@/lib/locations";

export async function GET() {
  if (isGuest(await getAuthSession())) {
    return NextResponse.json(
      { error: "Forbidden — guests have read-only calendar access" },
      { status: 403 },
    );
  }

  try {
    const locations = await listLocations();
    return NextResponse.json(locations, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: `Failed to get locations: ${error}` }, { status: 500 });
  }
}

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
    const newLocation = await createLocation(body.name);
    await recordAudit({
      actor: session,
      action: "create",
      entityType: "Location",
      entityId: newLocation.locationId,
      summary: `Created location "${newLocation.name}"`,
    });
    return NextResponse.json(newLocation, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: `Failed to create location: ${error}` }, { status: 500 });
  }
}
