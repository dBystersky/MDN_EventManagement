import { NextResponse } from "next/server";
import { getResource, updateResource, deleteResource } from "@/lib/resources";
import { Prisma } from "@/generated/prisma/client";

type RouteParams = {
    params: Promise<{ resourceId: string }>;
}

export async function GET(request: Request, context: RouteParams) {
    const { resourceId } = await context.params;
    const id  = Number(resourceId);

    try {
        const resource = await getResource(id);
        return NextResponse.json(resource, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: `Resource not found: ${error}` }, { status: 404 });
    }
}

export async function PATCH(request: Request, context: RouteParams) {
    const { resourceId } = await context.params;
    const id = Number(resourceId);
    const body = await request.json();

    try {
        const resource = await updateResource(id, {
            name: body.name,
            resourceTypeId: body.resourceTypeId !== undefined ? Number(body.resourceTypeId) : undefined,
        });
        return NextResponse.json(resource, { status: 200 });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return NextResponse.json({ error: `Resource not found: ${error}` }, { status: 404 });
        }
        return NextResponse.json({ error: `Failed to update resource: ${error}` }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: RouteParams) {
    const { resourceId } = await context.params;
    const id = Number(resourceId);

    try {
        await deleteResource(id);
        return NextResponse.json({ message: "Resource deleted successfully" }, { status: 200 });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return NextResponse.json({ error: `Resource not found: ${error}` }, { status: 404 });
        }
        return NextResponse.json({ error: `Failed to delete resource ${error}` }, { status: 500 });
    }
}
