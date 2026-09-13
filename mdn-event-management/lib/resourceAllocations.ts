import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

type PrismaTx = Prisma.TransactionClient;

/** Events store one datetime; allocations need a start and end. */
export const EVENT_ALLOCATION_DURATION_MS = 2 * 60 * 60 * 1000;

export function eventAllocationWindow(date: Date) {
    return {
        startTime: date,
        endTime: new Date(date.getTime() + EVENT_ALLOCATION_DURATION_MS),
    };
}

export async function replaceBookableAllocations(
    tx: PrismaTx,
    bookableId: number,
    resourceIds: number[],
    date: Date,
) {
    const { startTime, endTime } = eventAllocationWindow(date);
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
    date: Date,
) {
    const { startTime, endTime } = eventAllocationWindow(date);
    await tx.resourceAllocation.updateMany({
        where: { bookableId },
        data: { startTime, endTime },
    });
}

type createAllocationInput = {
    resourceId: number;
    startTime: Date;
    endTime: Date;
    bookableId: number;
}

export async function createAllocation(input: createAllocationInput) {
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
        }
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
        }
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
        }
    });
}

type updateAllocationInput = {
    resourceId?: number;
    startTime?: Date;
    endTime?: Date;
    bookableId?: number;
}

export async function updateAllocation(allocationId: number, input: updateAllocationInput) {
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
        }
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
