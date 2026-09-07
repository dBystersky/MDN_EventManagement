import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { memberPublicSelect } from "@/lib/members";
import {
    eventAllocationWindow,
    replaceBookableAllocations,
    rescheduleBookableAllocations,
} from "@/lib/resourceAllocations";

type PrismaTx = Prisma.TransactionClient;

const eventInclude = {
    location: true,
    bookable: {
        include: {
            resourceAllocations: {
                include: {
                    resource: { include: { resourceTypeRel: true } },
                },
            },
        },
    },
    eventManagers: { include: { member: { select: memberPublicSelect } } },
    tasks: true,
} satisfies Prisma.EventInclude;

export async function recalculateEventTotalBudget(tx: PrismaTx, eventId: number) {
    const { _sum } = await tx.task.aggregate({
        where: { eventId },
        _sum: { budget: true },
    });

    return tx.event.update({
        where: { eventId },
        data: { totalBudget: _sum.budget ?? 0 },
    });
}

type createEventInput = {
    name: string;
    description: string;
    date: Date;
    locationId: number;
    managerIds?: number[];
    resourceIds?: number[];
}

export async function createEvent(input: createEventInput) {
    const window = eventAllocationWindow(input.date);

    return prisma.event.create({
        data: {
            name: input.name,
            description: input.description,
            date: input.date,
            location: { connect: { locationId: input.locationId }},
            bookable: {
                create: {
                    bookableType: "Event",
                    resourceAllocations: input.resourceIds?.length
                        ? {
                            create: [...new Set(input.resourceIds)].map((resourceId) => ({
                                resourceId,
                                startTime: window.startTime,
                                endTime: window.endTime,
                            })),
                        }
                        : undefined,
                },
            },
            eventManagers: input.managerIds?.length
                ? { create: input.managerIds.map((memberId: number) => ({ memberId }))}
                : undefined,
        },
        include: eventInclude,
    });
}

export async function listEvents() {
    return prisma.event.findMany({
        orderBy: { date: "asc" },
        include: eventInclude,
    })
}

export async function readEvent(eventId: number) {
    return prisma.event.findUnique({
        where: { eventId },
        include: eventInclude,
    })
}

type updateEventInput = {
    name?: string;
    description?: string | null;
    date?: Date;
    locationId?: number;
    managerIds?: number[];
    resourceIds?: number[];
}

export async function updateEvent(eventId: number, input: updateEventInput) {
    return prisma.$transaction(async (tx) => {
        const existing = await tx.event.findUniqueOrThrow({
            where: { eventId },
            select: { date: true, bookableId: true },
        });

        const nextDate = input.date ?? existing.date;

        await tx.event.update({
            where: { eventId },
            data: {
                name: input.name,
                description: input.description,
                date: input.date,
                ...(input.locationId !== undefined
                    ? { location: { connect: { locationId: input.locationId }}}
                    : {}
                ),
                ...(input.managerIds !== undefined
                    ? {
                        eventManagers: {
                            deleteMany: {},
                            create: input.managerIds.map((memberId) => ({ memberId })),
                        },
                    }
                    : {}
                ),
            },
        });

        if (input.resourceIds !== undefined) {
            await replaceBookableAllocations(
                tx,
                existing.bookableId,
                input.resourceIds,
                nextDate,
            );
        } else if (input.date !== undefined) {
            await rescheduleBookableAllocations(tx, existing.bookableId, nextDate);
        }

        return tx.event.findUniqueOrThrow({
            where: { eventId },
            include: eventInclude,
        });
    });
}

export async function deleteEvent(eventId: number) {
    // Ensure event exists before delete attempt
    const event = await prisma.event.findUniqueOrThrow({
        where: {eventId},
        select: {
            bookableId: true,
        },
    });

    return prisma.$transaction(async (tx) => {
        // delete all associated event managers
        await tx.eventManager.deleteMany({ where: { eventId } });

        // delete all associated allocations that are linked to event
        await tx.resourceAllocation.deleteMany({
            where: { bookableId: event.bookableId },
        });

        // unlink any tasks from this event rather than deleting them
        await tx.task.updateMany({ where: { eventId }, data: { eventId: null } });

        // delete event itself
        await tx.event.delete({ where: { eventId } });

        // delete associated bookable object
        await tx.bookable.delete({
            where: { bookableId: event.bookableId },
        });
    });
}
