import { NextResponse } from "next/server";
import { getLocation } from "@/lib/locations";

type RouteParams = {
    params: Promise<{ locationId: string }>;
}

export async function GET(request: Request, context: RouteParams) {
        // Extract the eventId from the URL parameters
        const { locationId } = await context.params;
        const id  = Number(locationId);
    
        try {
            // Get the event from the database
            const event = await getLocation(id);
    
            // Return the found event
            return NextResponse.json(event, { status: 200 });
        } catch (error) {
            return NextResponse.json({ error: `Location not found: ${error}` }, { status: 404 }); 
        }
}

export async function PATCH() {

}

export async function DELETE() {
    
}