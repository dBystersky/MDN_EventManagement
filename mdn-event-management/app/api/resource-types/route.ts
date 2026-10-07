import { NextResponse } from "next/server";
import { validationFailed } from "@/lib/api-errors";
import { validateNamed } from "@/lib/validation";
import { getAuthSession, isGuest } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { createResourceType, listResourceTypes } from "@/lib/resourceTypes";
import { Prisma } from "@/generated/prisma/client";

export async function GET() {
  if (isGuest(await getAuthSession())) {
    return NextResponse.json(
      { error: "Forbidden — guests have read-only calendar access" },
      { status: 403 },
    );
  }

  try {
    const resourceTypes = await listResourceTypes();
    return NextResponse.json(resourceTypes, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: `Failed to get resource types: ${error}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (isGuest(session)) {
    return NextResponse.json(
      { error: "Forbidden — guests have read-only calendar access" },
      { status: 403 },
    );
  }

  const body = await request.json();

  const invalid = validationFailed(validateNamed(body, "resource type"));
  if (invalid) return invalid;

  try {
    const newResourceType = await createResourceType(body.name);
    await recordAudit({
      actor: session,
      action: "create",
      entityType: "ResourceType",
      entityId: newResourceType.typeId,
      summary: `Created resource type "${newResourceType.name}"`,
    });
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
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: `Failed to create resource type: ${error}` },
      { status: 500 },
    );
  }
}
