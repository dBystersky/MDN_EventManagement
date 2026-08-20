import { NextResponse } from "next/server";
import { getResourceType, updateResourceType, deleteResourceType } from "@/lib/resourceTypes";
import { Prisma } from "@/generated/prisma/client";

type RouteParams = {
    params: Promise<{ typeId: string }>;
}

export async function GET(request: Request, context: RouteParams) {
    const { typeId } = await context.params;
    const id  = Number(typeId);

    try {
        const resourceType = await getResourceType(id);
        return NextResponse.json(resourceType, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: `Resource type not found: ${error}` }, { status: 404 });
    }
}

export async function PATCH(request: Request, context: RouteParams) {
    const { typeId } = await context.params;
    const id = Number(typeId);
    const body = await request.json();

    try {
        const resourceType = await updateResourceType(id, body.name);
        return NextResponse.json(resourceType, { status: 200 });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return NextResponse.json({ error: `Resource type not found: ${error}` }, { status: 404 });
        }
        return NextResponse.json({ error: `Failed to update resource type: ${error}` }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: RouteParams) {
    const { typeId } = await context.params;
    const id = Number(typeId);

    try {
        await deleteResourceType(id);
        return NextResponse.json({ message: "Resource type deleted successfully" }, { status: 200 });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            return NextResponse.json({ error: `Resource type not found: ${error}` }, { status: 404 });
        }
        return NextResponse.json({ error: `Failed to delete resource type ${error}` }, { status: 500 });
    }
}
