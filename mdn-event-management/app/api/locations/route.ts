import { NextResponse } from "next/server";
import { validationFailed } from "@/lib/api-errors";
import { validateNamed } from "@/lib/validation";
import { createLocation, listLocations } from "@/lib/locations";

export async function GET() {
    try {
        const locations = await listLocations();
        return NextResponse.json(locations, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: `Failed to get locations: ${error}` }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const body = await request.json();

    const invalid = validationFailed(validateNamed(body, "location"));
    if (invalid) return invalid;

    try {
        const newLocation = await createLocation(body.name);
        return NextResponse.json(newLocation, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: `Failed to create location: ${error}` }, { status: 500 });
    }
}