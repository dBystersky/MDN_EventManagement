import { prisma } from "@/lib/prisma";

type createEventInput = {
    name: string;
    description: string;
    date: Date;
    locationId: number;
    managerIds?: number[];
}

export async function createEvent(input: createEventInput) {
    return prisma.event.create({
        data: {
            name: input.name,
            description: input.description,
            date: input.date,
            location: { connect: { locationId: input.locationId }},
            bookable: { create: { bookableType: "Event" }},
            eventManagers: input.managerIds?.length
                ? { create: input.managerIds.map((memberId: number) => ({ memberId }))}
                : undefined,
        },
        include: {
            location: true,
            bookable: true,
            eventManagers: { include: {member: true}}
        }
    });
}

export async function listEvents() {
    return prisma.event.findMany({
        orderBy: { date: "asc" },
        include: {
            location: true,
            bookable: true,
            eventManagers: { include: { member: true } }
        }
    })
}

export async function readEvent(eventId: number) {
    return prisma.event.findUnique({
        where: { eventId },
        include: {
            location: true,
            bookable: true,
            eventManagers: { include: { member: true } }
        }
    })
}

type updateEventInput = {
    name?: string;
    description?: string | null;
    date?: Date;
    locationId?: number;
}

export async function updateEvent(eventId: number, input: updateEventInput) {
    return prisma.event.update({
        where: { eventId },
        data: {
            name: input.name,
            description: input.description,
            date: input.date,
            ...(input.locationId !== undefined
                ? { location: { connect: { locationId: input.locationId }}}
                : {}
            )
        },
        include: {
            location: true,
            bookable: true,
            eventManagers: { include: { member: true } },
        }
    })
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

        // delete event itself
        await tx.event.delete({ where: { eventId } });

        // delete associated bookable object
        await tx.bookable.delete({
            where: { bookableId: event.bookableId },
        });
    });
}