import { NextResponse } from "next/server";
import { createAllocation, listAllocations } from "@/lib/resourceAllocations";
import { conflictsForAllocation } from "@/lib/conflictQueries";
import { isBadRequest } from "@/lib/api-errors";
import { Prisma } from "@/generated/prisma/client";

export async function GET() {
    try {
        const allocations = await listAllocations();
        return NextResponse.json(allocations, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: `Failed to get resource allocations: ${error}` }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const body = await request.json();

    try {
        const newAllocation = await createAllocation({
            resourceId: Number(body.resourceId),
            startTime: new Date(body.startTime),
            endTime: new Date(body.endTime),
            bookableId: Number(body.bookableId),
        });
        // Flag, never block: a double-booked resource still saves, and the
        // caller is told what it now collides with (RTM Req 7).
        const conflicts = await conflictsForAllocation(newAllocation.allocationId);

        return NextResponse.json({ ...newAllocation, conflicts }, { status: 201 });
    } catch (error) {
        console.error(error);
        if (isBadRequest(error)) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            return NextResponse.json(
                {
                  error: "Failed to create resource allocation",
                  code: error.code,
                  meta: error.meta,
                  message: error.message,
                },
                { status: 500 }
              );
        }
        return NextResponse.json({ error: `Failed to create resource allocation: ${error}` }, { status: 500 });
    }
}
