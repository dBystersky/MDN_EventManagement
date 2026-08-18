import { NextResponse } from "next/server";
import { readEvent, deleteEvent, updateEvent } from "@/lib/events";

type RouteParams = {
    params: Promise<{ eventId: string }>;
}

// Functino to get individual event from the API
export async function GET(request: Request, context: RouteParams) {
    // Extract the eventId from the URL parameters
    const { eventId } = await context.params;
    const id  = Number(eventId);

    // Get the event from the database
    const event = await readEvent(id);

    // If the event is not found, return a 404 error
    if (!event) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Return the found event
    return NextResponse.json(event, { status: 200 });
}

export async function PATCH(request: Request, context: RouteParams) {

}

export async function DELETE(request: Request, context: RouteParams){

}