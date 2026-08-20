import { NextResponse } from "next/server";
import { createResourceType, listResourceTypes } from "@/lib/resourceTypes";
import { Prisma } from "@/generated/prisma/client";

export async function GET() {
    try {
        const resourceTypes = await listResourceTypes();
        return NextResponse.json(resourceTypes, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: `Failed to get resource types: ${error}` }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const body = await request.json();

    try {
        const newResourceType = await createResourceType(body.name);
        return NextResponse.json(newResourceType, { status: 201 });
    } catch (error) {
        console.error(error);
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            return NextResponse.json(
                {
                  error: "Failed to create resource type",
                  code: error.code,
                  meta: error.meta,
                  message: error.message,
                },
                { status: 500 }
              );
        }
        return NextResponse.json({ error: `Failed to create resource type: ${error}` }, { status: 500 });
    }
}
