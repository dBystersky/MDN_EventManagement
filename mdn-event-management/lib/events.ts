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

export async function updateEvent() {}

export async function deleteEvent() {}