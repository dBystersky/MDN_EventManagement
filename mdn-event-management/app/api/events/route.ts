import { NextResponse } from "next/server";
import { createEvent, listEvents } from "@/lib/events";

// Function to get all events from the API
export async function GET() {
    const events = await listEvents();
    return NextResponse.json(events, { status: 200 });
}

// Function to create a new event
export async function POST(request: Request) {
    const body = await request.json();

    const newEvent = await createEvent({
        name: body.name,
        description: body.description,
        date: body.date,
        locationId: body.locationId,
        managerIds: body.managerIds,
    });

    return NextResponse.json(newEvent, { status: 201 });
}