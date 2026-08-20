import { prisma } from "@/lib/prisma";

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
