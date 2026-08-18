import { NextResponse } from "next/server";
import { createEvent, listEvents } from "@/lib/events";

// Function to get all events from the API
export async function GET() {
    try {
        const events = await listEvents();
        return NextResponse.json(events, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: "Failed to get events" }, { status: 500 });
    }
}

// Function to create a new event
export async function POST(request: Request) {
    const body = await request.json();

    try {
        const newEvent = await createEvent({
            name: body.name,
            description: body.description,
            date: body.date,
            locationId: body.locationId,
            managerIds: body.managerIds,
        });
    
        return NextResponse.json(newEvent, { status: 201 });

    } catch (error) {
        return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
    }
    
}