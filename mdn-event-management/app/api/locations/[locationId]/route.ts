import { NextResponse } from "next/server";
import { getAuthSession, isGuest } from "@/lib/auth";
import { getLocation, updateLocation, deleteLocation } from "@/lib/locations";

type RouteParams = {
    params: Promise<{ locationId: string }>;
}

export async function GET(request: Request, context: RouteParams) {
    if (isGuest(await getAuthSession())) {
        return NextResponse.json({ error: "Forbidden — guests have read-only calendar access" }, { status: 403 });
    }

        // Extract the locationId from the URL parameters
        const { locationId } = await context.params;
        const id  = Number(locationId);
    
        try {
            // Get the location from the database
            const event = await getLocation(id);
    
            // Return the found location
            return NextResponse.json(event, { status: 200 });
        } catch (error) {
            return NextResponse.json({ error: `Location not found: ${error}` }, { status: 404 }); 
        }
}

export async function PATCH(request: Request, context: RouteParams, ) {
    if (isGuest(await getAuthSession())) {
        return NextResponse.json({ error: "Forbidden — guests have read-only calendar access" }, { status: 403 });
    }

    const { locationId } = await context.params;
    const id = Number(locationId);
    
    try{
        const body = await request.json();
        const { name } = body;

        const updatedLocation = await updateLocation(id, name);

        return NextResponse.json(updatedLocation, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: `Failed to update location: ${error}` }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: RouteParams) {
    if (isGuest(await getAuthSession())) {
        return NextResponse.json({ error: "Forbidden — guests have read-only calendar access" }, { status: 403 });
    }

    const { locationId } = await context.params;
    const id = Number(locationId);

    try{
        await deleteLocation(id);
        return NextResponse.json({ message: "Location deleted successfully" }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: `Failed to delete location: ${error}` }, { status: 500 });
    }
}