import { NextResponse } from "next/server";
import { getAuthSession, isGuest } from "@/lib/auth";
import { createAllocation, listAllocations } from "@/lib/resourceAllocations";
import { Prisma } from "@/generated/prisma/client";

export async function GET() {
    if (isGuest(await getAuthSession())) {
        return NextResponse.json({ error: "Forbidden — guests have read-only calendar access" }, { status: 403 });
    }

    try {
        const allocations = await listAllocations();
        return NextResponse.json(allocations, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: `Failed to get resource allocations: ${error}` }, { status: 500 });
    }
}

export async function POST(request: Request) {
    if (isGuest(await getAuthSession())) {
        return NextResponse.json({ error: "Forbidden — guests have read-only calendar access" }, { status: 403 });
    }

    const body = await request.json();

    try {
        const newAllocation = await createAllocation({
            resourceId: Number(body.resourceId),
            startTime: new Date(body.startTime),
            endTime: new Date(body.endTime),
            bookableId: Number(body.bookableId),
        });
        return NextResponse.json(newAllocation, { status: 201 });
    } catch (error) {
        console.error(error);
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
