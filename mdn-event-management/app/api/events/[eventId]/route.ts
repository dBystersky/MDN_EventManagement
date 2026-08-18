import { NextResponse } from "next/server";
import { readEvent, deleteEvent, updateEvent } from "@/lib/events";
import { Prisma } from "@/generated/prisma/client";

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
    // Extract the eventId from the URL parameters
    const { eventId } = await context.params;
    const id = Number(eventId);

    // Extract the params to update event with
    const body = await request.json();

    try {
        // Update the event
        const event = await updateEvent(id, {
            name: body.name,
            description: body.description,
            date: body.date !== undefined ? new Date(body.date) : undefined,
            locationId: body.locationId !== undefined ? Number(body.locationId) : undefined,
        });

        // Return the updated event
        return NextResponse.json(event, { status: 200 });
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError
        ) {
            if (error.code === 'P2025') {
                return NextResponse.json({ error: "Event not found" }, { status: 404 });
            }

            return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
        }

        return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: RouteParams){

}