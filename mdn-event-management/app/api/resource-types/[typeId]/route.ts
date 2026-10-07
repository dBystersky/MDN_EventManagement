import { NextResponse } from "next/server";
import { validationFailed } from "@/lib/api-errors";
import { validateNamed } from "@/lib/validation";
import { getAuthSession, isGuest } from "@/lib/auth";
import { changedFields, findAllocationDependents, recordAudit, recordCascade } from "@/lib/audit";
import { getResourceType, updateResourceType, deleteResourceType } from "@/lib/resourceTypes";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  params: Promise<{ typeId: string }>;
};

export async function GET(request: Request, context: RouteParams) {
  if (isGuest(await getAuthSession())) {
    return NextResponse.json(
      { error: "Forbidden — guests have read-only calendar access" },
      { status: 403 },
    );
  }

  const { typeId } = await context.params;
  const id = Number(typeId);

  try {
    const resourceType = await getResourceType(id);
    return NextResponse.json(resourceType, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: `Resource type not found: ${error}` }, { status: 404 });
  }
}

export async function PATCH(request: Request, context: RouteParams) {
  const session = await getAuthSession();
  if (isGuest(session)) {
    return NextResponse.json(
      { error: "Forbidden — guests have read-only calendar access" },
      { status: 403 },
    );
  }

  const { typeId } = await context.params;
  const id = Number(typeId);
  const body = await request.json();

  const invalid = validationFailed(validateNamed(body, "resource type"));
  if (invalid) return invalid;

  try {
    const resourceType = await updateResourceType(id, body.name);
    await recordAudit({
      actor: session,
      action: "update",
      entityType: "ResourceType",
      entityId: id,
      summary: `Updated resource type "${resourceType.name}"`,
      changes: { fields: changedFields(body) },
    });
    return NextResponse.json(resourceType, { status: 200 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: `Resource type not found: ${error}` }, { status: 404 });
    }
    return NextResponse.json(
      { error: `Failed to update resource type: ${error}` },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: RouteParams) {
  const session = await getAuthSession();
  if (isGuest(session)) {
    return NextResponse.json(
      { error: "Forbidden — guests have read-only calendar access" },
      { status: 403 },
    );
  }

  const { typeId } = await context.params;
  const id = Number(typeId);

  try {
    const before = await getResourceType(id);
    const resources =
      (await prisma.resource.findMany({
        where: { resourceType: id },
        select: { resourceId: true, name: true },
      })) ?? [];
    const allocations = await findAllocationDependents({
      resourceId: { in: resources.map((r) => r.resourceId) },
    });
    await deleteResourceType(id);
    const because = `resource type #${id} was deleted`;
    await recordCascade(session, "delete", "ResourceAllocation", allocations, because);
    await recordCascade(
      session,
      "delete",
      "Resource",
      resources.map((r) => ({ id: r.resourceId, label: `resource "${r.name}"` })),
      because,
    );
    await recordAudit({
      actor: session,
      action: "delete",
      entityType: "ResourceType",
      entityId: id,
      summary: `Deleted resource type ${before ? `"${before.name}"` : `#${id}`}`,
    });
    return NextResponse.json({ message: "Resource type deleted successfully" }, { status: 200 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: `Resource type not found: ${error}` }, { status: 404 });
    }
    return NextResponse.json({ error: `Failed to delete resource type ${error}` }, { status: 500 });
  }
}
