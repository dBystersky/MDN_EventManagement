import { NextResponse } from "next/server";
import { validateAllocation } from "@/lib/validation";
import { getAuthSession, isGuest } from "@/lib/auth";
import { getAllocation, updateAllocation, deleteAllocation } from "@/lib/resourceAllocations";
import { conflictsForAllocation } from "@/lib/conflictQueries";
import { isBadRequest, validationFailed } from "@/lib/api-errors";
import { Prisma } from "@/generated/prisma/client";
import { changedFields, recordAudit } from "@/lib/audit";

type RouteParams = {
  params: Promise<{ allocationId: string }>;
};

export async function GET(request: Request, context: RouteParams) {
  if (isGuest(await getAuthSession())) {
    return NextResponse.json(
      { error: "Forbidden — guests have read-only calendar access" },
      { status: 403 },
    );
  }

  const { allocationId } = await context.params;
  const id = Number(allocationId);

  try {
    const allocation = await getAllocation(id);
    return NextResponse.json(allocation, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: `Resource allocation not found: ${error}` }, { status: 404 });
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

  const { allocationId } = await context.params;
  const id = Number(allocationId);
  const body = await request.json();

  const invalid = validationFailed(validateAllocation(body, { partial: true }));
  if (invalid) return invalid;

  try {
    const allocation = await updateAllocation(id, {
      resourceId: body.resourceId !== undefined ? Number(body.resourceId) : undefined,
      startTime: body.startTime !== undefined ? new Date(body.startTime) : undefined,
      endTime: body.endTime !== undefined ? new Date(body.endTime) : undefined,
      bookableId: body.bookableId !== undefined ? Number(body.bookableId) : undefined,
    });
    const fields = changedFields(body);
    await recordAudit({
      actor: session,
      action: "update",
      entityType: "ResourceAllocation",
      entityId: allocation.allocationId,
      summary: `Updated allocation #${allocation.allocationId} (resource #${allocation.resourceId})`,
      changes: { fields },
    });
    // Flag, never block — see POST /api/resource-allocations.
    const conflicts = await conflictsForAllocation(id);

    return NextResponse.json({ ...allocation, conflicts }, { status: 200 });
  } catch (error) {
    if (isBadRequest(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json(
        { error: `Resource allocation not found: ${error}` },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: `Failed to update resource allocation: ${error}` },
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

  const { allocationId } = await context.params;
  const id = Number(allocationId);

  try {
    const before = await getAllocation(id);
    await deleteAllocation(id);
    await recordAudit({
      actor: session,
      action: "delete",
      entityType: "ResourceAllocation",
      entityId: id,
      summary: before
        ? `Removed allocation of "${before.resource.name}"`
        : `Removed allocation #${id}`,
    });
    return NextResponse.json(
      { message: "Resource allocation deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json(
        { error: `Resource allocation not found: ${error}` },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: `Failed to delete resource allocation ${error}` },
      { status: 500 },
    );
  }
}
