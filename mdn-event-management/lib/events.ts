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
    tasks: {
        include: {
            taskManagers: { include: { member: { select: memberPublicSelect } } },
            bookable: {
                include: {
                    resourceAllocations: {
                        include: { resource: true },
                    },
                },
            },
        },
    },
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

export type EventSubtaskInput = {
    name: string;
    description?: string;
    deadline: Date;
    managerIds?: number[];
    resourceIds?: number[];
    budget?: number | null;
}

export function parseEventSubtasks(value: unknown): EventSubtaskInput[] | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) {
        throw new Error("subtasks must be an array");
    }

    return value.map((item, index) => {
        if (!item || typeof item !== "object") {
            throw new Error(`subtasks[${index}] must be an object`);
        }
        const row = item as Record<string, unknown>;
        const name = String(row.name ?? "").trim();
        const deadline = new Date(String(row.deadline ?? ""));
        if (!name) {
            throw new Error(`subtasks[${index}] needs a name`);
        }
        if (Number.isNaN(deadline.getTime())) {
            throw new Error(`subtasks[${index}] needs a valid deadline`);
        }
        const budget =
            row.budget === undefined || row.budget === null
                ? undefined
                : Number(row.budget);
        if (budget !== undefined && Number.isNaN(budget)) {
            throw new Error(`subtasks[${index}] has an invalid budget`);
        }
        if (budget !== undefined && budget < 0) {
            throw new Error("budget must not be negative");
        }

        return {
            name,
            description: row.description == null ? "" : String(row.description),
            deadline,
            managerIds: Array.isArray(row.managerIds)
                ? row.managerIds.map(Number).filter((id) => Number.isFinite(id))
                : undefined,
            resourceIds: Array.isArray(row.resourceIds)
                ? row.resourceIds.map(Number).filter((id) => Number.isFinite(id))
                : undefined,
            budget,
        };
    });
}

type createEventInput = {
    name: string;
    description: string;
    date: Date;
    locationId: number;
    managerIds?: number[];
    resourceIds?: number[];
    taskIds?: number[];
    subtasks?: EventSubtaskInput[];
}

async function syncEventTasks(tx: PrismaTx, eventId: number, taskIds: number[]) {
    const uniqueIds = [...new Set(taskIds)];
    const affectedEventIds = new Set<number>([eventId]);

    if (uniqueIds.length) {
        const incoming = await tx.task.findMany({
            where: { taskId: { in: uniqueIds } },
            select: { taskId: true, eventId: true },
        });
        if (incoming.length !== uniqueIds.length) {
            throw new Error("One or more tasks were not found");
        }
        for (const task of incoming) {
            if (task.eventId != null && task.eventId !== eventId) {
                affectedEventIds.add(task.eventId);
            }
        }
    }

    await tx.event.update({
        where: { eventId },
        data: {
            tasks: {
                set: uniqueIds.map((taskId) => ({ taskId })),
            },
        },
    });

    for (const id of affectedEventIds) {
        await recalculateEventTotalBudget(tx, id);
    }
}

async function createEventSubtasks(
    tx: PrismaTx,
    eventId: number,
    subtasks: EventSubtaskInput[],
) {
    for (const subtask of subtasks) {
        const window = eventAllocationWindow(subtask.deadline);
        await tx.task.create({
            data: {
                name: subtask.name,
                description: subtask.description ?? "",
                deadline: subtask.deadline,
                budget: subtask.budget ?? undefined,
                event: { connect: { eventId } },
                bookable: {
                    create: {
                        bookableType: "Task",
                        resourceAllocations: subtask.resourceIds?.length
                            ? {
                                create: [...new Set(subtask.resourceIds)].map((resourceId) => ({
                                    resourceId,
                                    startTime: window.startTime,
                                    endTime: window.endTime,
                                })),
                            }
                            : undefined,
                    },
                },
                taskManagers: subtask.managerIds?.length
                    ? { create: subtask.managerIds.map((memberId) => ({ memberId })) }
                    : undefined,
            },
        });
    }

    if (subtasks.length) {
        await recalculateEventTotalBudget(tx, eventId);
    }
}

export async function createEvent(input: createEventInput) {
    const window = eventAllocationWindow(input.date);

    return prisma.$transaction(async (tx) => {
        const event = await tx.event.create({
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

        if (input.taskIds !== undefined) {
            await syncEventTasks(tx, event.eventId, input.taskIds);
        }
        if (input.subtasks?.length) {
            await createEventSubtasks(tx, event.eventId, input.subtasks);
        }
        if (input.taskIds === undefined && !input.subtasks?.length) {
            return event;
        }

        return tx.event.findUniqueOrThrow({
            where: { eventId: event.eventId },
            include: eventInclude,
        });
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
    taskIds?: number[];
    subtasks?: EventSubtaskInput[];
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

        if (input.taskIds !== undefined) {
            await syncEventTasks(tx, eventId, input.taskIds);
        }
        if (input.subtasks?.length) {
            await createEventSubtasks(tx, eventId, input.subtasks);
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
