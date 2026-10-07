import { NextResponse } from "next/server";
import { validationFailed } from "@/lib/api-errors";
import { validateResource } from "@/lib/validation";
import { getAuthSession, isGuest } from "@/lib/auth";
import { changedFields, findAllocationDependents, recordAudit, recordCascade } from "@/lib/audit";
import { getResource, updateResource, deleteResource } from "@/lib/resources";
import { Prisma } from "@/generated/prisma/client";

type RouteParams = {
  params: Promise<{ resourceId: string }>;
};

export async function GET(request: Request, context: RouteParams) {
  if (isGuest(await getAuthSession())) {
    return NextResponse.json(
      { error: "Forbidden — guests have read-only calendar access" },
      { status: 403 },
    );
  }

  const { resourceId } = await context.params;
  const id = Number(resourceId);

  try {
    const resource = await getResource(id);
    return NextResponse.json(resource, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: `Resource not found: ${error}` }, { status: 404 });
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

  const { resourceId } = await context.params;
  const id = Number(resourceId);
  const body = await request.json();

  const invalid = validationFailed(validateResource(body, { partial: true }));
  if (invalid) return invalid;

  try {
    const resource = await updateResource(id, {
      name: body.name,
      resourceTypeId: body.resourceTypeId !== undefined ? Number(body.resourceTypeId) : undefined,
    });
    await recordAudit({
      actor: session,
      action: "update",
      entityType: "Resource",
      entityId: id,
      summary: `Updated resource "${resource.name}"`,
      changes: { fields: changedFields(body) },
    });
    return NextResponse.json(resource, { status: 200 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: `Resource not found: ${error}` }, { status: 404 });
    }
    return NextResponse.json({ error: `Failed to update resource: ${error}` }, { status: 500 });
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

  const { resourceId } = await context.params;
  const id = Number(resourceId);

  try {
    const before = await getResource(id);
    const allocations = await findAllocationDependents({ resourceId: id });
    await deleteResource(id);
    await recordCascade(
      session,
      "delete",
      "ResourceAllocation",
      allocations,
      `resource #${id} was deleted`,
    );
    await recordAudit({
      actor: session,
      action: "delete",
      entityType: "Resource",
      entityId: id,
      summary: `Deleted resource ${before ? `"${before.name}"` : `#${id}`}`,
    });
    return NextResponse.json({ message: "Resource deleted successfully" }, { status: 200 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: `Resource not found: ${error}` }, { status: 404 });
    }
    return NextResponse.json({ error: `Failed to delete resource ${error}` }, { status: 500 });
  }
}
