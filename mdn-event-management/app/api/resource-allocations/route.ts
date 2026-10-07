import { NextResponse } from "next/server";
import { validateAllocation } from "@/lib/validation";
import { createAllocation, listAllocations } from "@/lib/resourceAllocations";
import { conflictsForAllocation } from "@/lib/conflictQueries";
import { isBadRequest, validationFailed } from "@/lib/api-errors";
import { getAuthSession, isGuest } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { Prisma } from "@/generated/prisma/client";

export async function GET() {
  if (isGuest(await getAuthSession())) {
    return NextResponse.json(
      { error: "Forbidden — guests have read-only calendar access" },
      { status: 403 },
    );
  }

  try {
    const allocations = await listAllocations();
    return NextResponse.json(allocations, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to get resource allocations: ${error}` },
      { status: 500 },
    );
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

  const invalid = validationFailed(validateAllocation(body));
  if (invalid) return invalid;

  try {
    const newAllocation = await createAllocation({
      resourceId: Number(body.resourceId),
      startTime: new Date(body.startTime),
      endTime: new Date(body.endTime),
      bookableId: Number(body.bookableId),
    });
    await recordAudit({
      actor: session,
      action: "create",
      entityType: "ResourceAllocation",
      entityId: newAllocation.allocationId,
      summary: `Allocated resource #${newAllocation.resourceId} to booking #${newAllocation.bookableId}`,
    });
    // Flag, never block: a double-booked resource still saves, and the
    // caller is told what it now collides with (RTM Req 7).
    const conflicts = await conflictsForAllocation(newAllocation.allocationId);

    return NextResponse.json({ ...newAllocation, conflicts }, { status: 201 });
  } catch (error) {
    console.error(error);
    if (isBadRequest(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        {
          error: "Failed to create resource allocation",
          code: error.code,
          meta: error.meta,
          message: error.message,
        },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: `Failed to create resource allocation: ${error}` },
      { status: 500 },
    );
  }
}
