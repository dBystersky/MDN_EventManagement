import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { DEFAULT_BOOKING_DURATION_MS } from "@/lib/datetime";

type PrismaTx = Prisma.TransactionClient;

/** The window a resource is held for. */
export type BookingWindow = { startTime: Date; endTime: Date };

/**
 * A window around a single instant, for a bookable that has no range of its own.
 *
 * Only tasks need this now — a task's `deadline` is genuinely a point in time.
 * Events carry a real start and end, so they pass their own span straight
 * through rather than having one invented for them.
 */
export function defaultWindowFrom(instant: Date): BookingWindow {
  return {
    startTime: instant,
    endTime: new Date(instant.getTime() + DEFAULT_BOOKING_DURATION_MS),
  };
}

/**
 * Guards every write that stores a range.
 *
 * Clash detection compares half-open intervals, so an inverted or zero-length
 * one is not merely odd — it silently drops out of `lib/conflicts.ts` and the
 * booking is never checked against anything. Rejecting it here is what makes
 * "flag, never block" safe: a clash is always allowed, a nonsense range never is.
 */
export function assertForwardWindow(
  startTime: Date,
  endTime: Date,
  // Named so the message uses the caller's own field names — an events API
  // client should not be told about "startTime".
  fields: { start: string; end: string } = { start: "startTime", end: "endTime" },
) {
  if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
    throw new Error(`${fields.start} and ${fields.end} must be valid dates`);
  }
  if (endTime.getTime() <= startTime.getTime()) {
    throw new Error(`${fields.end} must be after ${fields.start}`);
  }
}

export async function replaceBookableAllocations(
  tx: PrismaTx,
  bookableId: number,
  resourceIds: number[],
  window: BookingWindow,
) {
  const { startTime, endTime } = window;
  assertForwardWindow(startTime, endTime);
  await tx.resourceAllocation.deleteMany({ where: { bookableId } });
  if (resourceIds.length === 0) return;
  const uniqueIds = [...new Set(resourceIds)];
  await tx.resourceAllocation.createMany({
    data: uniqueIds.map((resourceId) => ({
      resourceId,
      bookableId,
      startTime,
      endTime,
    })),
  });
}

export async function rescheduleBookableAllocations(
  tx: PrismaTx,
  bookableId: number,
  window: BookingWindow,
) {
  const { startTime, endTime } = window;
  assertForwardWindow(startTime, endTime);
  await tx.resourceAllocation.updateMany({
    where: { bookableId },
    data: { startTime, endTime },
  });
}

/**
 * Move a bookable's whole booking window by `deltaMs`.
 *
 * Used when a task's deadline moves. A *reset* to `defaultWindowFrom(deadline)`
 * would be wrong here: unlike an event, whose span defines its bookings, a task
 * can have bookings made by hand on the allocations page with a deliberate
 * window. Shifting preserves those durations and offsets, and for an
 * auto-created subtask booking — which sits at exactly [deadline, deadline+2h) —
 * a shift and a reset land in the same place anyway.
 */
export async function shiftBookableAllocations(tx: PrismaTx, bookableId: number, deltaMs: number) {
  if (deltaMs === 0) return;

  const allocations = await tx.resourceAllocation.findMany({
    where: { bookableId },
    select: { allocationId: true, startTime: true, endTime: true },
  });

  // Per-row, because the shift is arithmetic on each stored value and
  // `updateMany` cannot express that.
  for (const allocation of allocations) {
    await tx.resourceAllocation.update({
      where: { allocationId: allocation.allocationId },
      data: {
        startTime: new Date(allocation.startTime.getTime() + deltaMs),
        endTime: new Date(allocation.endTime.getTime() + deltaMs),
      },
    });
  }
}

type createAllocationInput = {
  resourceId: number;
  startTime: Date;
  endTime: Date;
  bookableId: number;
};

export async function createAllocation(input: createAllocationInput) {
  assertForwardWindow(input.startTime, input.endTime);

  return prisma.resourceAllocation.create({
    data: {
      resourceId: input.resourceId,
      startTime: input.startTime,
      endTime: input.endTime,
      bookableId: input.bookableId,
    },
    include: {
      resource: {
        include: { resourceTypeRel: true },
      },
      bookable: true,
    },
  });
}

export async function listAllocations() {
  return prisma.resourceAllocation.findMany({
    orderBy: { startTime: "asc" },
    include: {
      resource: {
        include: { resourceTypeRel: true },
      },
      bookable: true,
    },
  });
}

export async function getAllocation(allocationId: number) {
  return prisma.resourceAllocation.findUnique({
    where: { allocationId },
    include: {
      resource: {
        include: { resourceTypeRel: true },
      },
      bookable: true,
    },
  });
}

type updateAllocationInput = {
  resourceId?: number;
  startTime?: Date;
  endTime?: Date;
  bookableId?: number;
};

export async function updateAllocation(allocationId: number, input: updateAllocationInput) {
  // Validate the range the row will END UP with: a PATCH that moves only the
  // start must still be checked against the stored end.
  const existing = await prisma.resourceAllocation.findUniqueOrThrow({
    where: { allocationId },
    select: { startTime: true, endTime: true },
  });
  assertForwardWindow(input.startTime ?? existing.startTime, input.endTime ?? existing.endTime);

  return prisma.resourceAllocation.update({
    where: { allocationId },
    data: {
      resourceId: input.resourceId,
      startTime: input.startTime,
      endTime: input.endTime,
      bookableId: input.bookableId,
    },
    include: {
      resource: {
        include: { resourceTypeRel: true },
      },
      bookable: true,
    },
  });
}

export async function deleteAllocation(allocationId: number) {
  await prisma.resourceAllocation.findUniqueOrThrow({
    where: { allocationId },
  });

  return prisma.resourceAllocation.delete({
    where: { allocationId },
  });
}
