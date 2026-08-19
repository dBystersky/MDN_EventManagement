import { NextResponse } from "next/server";
import { createEvent, listEvents } from "@/lib/events";
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

    try {
        const newEvent = await createEvent({
            name: body.name,
            description: body.description,
            date: new Date(body.date),
            locationId: Number(body.locationId),
            managerIds: body.managerIds,
        });
    
        return NextResponse.json(newEvent, { status: 201 });

    } catch (error) {
        console.error(error);
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            return NextResponse.json(
                {
                  error: "Failed to create event",
                  code: error.code,
                  meta: error.meta,
                  message: error.message,
                },
                { status: 500 }
              );
        }
        return NextResponse.json({ error: `Failed to create event: ${error}` }, { status: 500 });
    }
    
}