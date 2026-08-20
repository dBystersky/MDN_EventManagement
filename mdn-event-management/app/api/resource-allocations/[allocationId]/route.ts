import { NextResponse } from "next/server";
import { getAllocation, updateAllocation, deleteAllocation } from "@/lib/resourceAllocations";
import { Prisma } from "@/generated/prisma/client";

type RouteParams = {
    params: Promise<{ allocationId: string }>;
}

export async function GET(request: Request, context: RouteParams) {
    const { allocationId } = await context.params;
    const id  = Number(allocationId);

    try {
        const allocation = await getAllocation(id);
        return NextResponse.json(allocation, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: `Resource allocation not found: ${error}` }, { status: 404 });
    }
}

export async function PATCH(request: Request, context: RouteParams) {
    const { allocationId } = await context.params;
    const id = Number(allocationId);
    const body = await request.json();

    try {
        const allocation = await updateAllocation(id, {
            resourceId: body.resourceId !== undefined ? Number(body.resourceId) : undefined,
            startTime: body.startTime !== undefined ? new Date(body.startTime) : undefined,
            endTime: body.endTime !== undefined ? new Date(body.endTime) : undefined,
            bookableId: body.bookableId !== undefined ? Number(body.bookableId) : undefined,
        });
        return NextResponse.json(allocation, { status: 200 });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return NextResponse.json({ error: `Resource allocation not found: ${error}` }, { status: 404 });
        }
        return NextResponse.json({ error: `Failed to update resource allocation: ${error}` }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: RouteParams) {
    const { allocationId } = await context.params;
    const id = Number(allocationId);

    try {
        await deleteAllocation(id);
        return NextResponse.json({ message: "Resource allocation deleted successfully" }, { status: 200 });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return NextResponse.json({ error: `Resource allocation not found: ${error}` }, { status: 404 });
        }
        return NextResponse.json({ error: `Failed to delete resource allocation ${error}` }, { status: 500 });
    }
}
