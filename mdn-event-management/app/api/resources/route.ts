import { NextResponse } from "next/server";
import { getAuthSession, isGuest } from "@/lib/auth";
import { createResource, listResources } from "@/lib/resources";
import { Prisma } from "@/generated/prisma/client";

export async function GET() {
    if (isGuest(await getAuthSession())) {
        return NextResponse.json({ error: "Forbidden — guests have read-only calendar access" }, { status: 403 });
    }

    try {
        const resources = await listResources();
        return NextResponse.json(resources, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: `Failed to get resources: ${error}` }, { status: 500 });
    }
}

export async function POST(request: Request) {
    if (isGuest(await getAuthSession())) {
        return NextResponse.json({ error: "Forbidden — guests have read-only calendar access" }, { status: 403 });
    }

    const body = await request.json();

    try {
        const newResource = await createResource({
            name: body.name,
            resourceTypeId: Number(body.resourceTypeId),
        });
        return NextResponse.json(newResource, { status: 201 });
    } catch (error) {
        console.error(error);
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            return NextResponse.json(
                {
                  error: "Failed to create resource",
                  code: error.code,
                  meta: error.meta,
                  message: error.message,
                },
                { status: 500 }
              );
        }
        return NextResponse.json({ error: `Failed to create resource: ${error}` }, { status: 500 });
    }
}
