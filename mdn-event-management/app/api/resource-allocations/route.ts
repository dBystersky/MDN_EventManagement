import { NextResponse } from "next/server";
import { createAllocation, listAllocations } from "@/lib/resourceAllocations";
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
