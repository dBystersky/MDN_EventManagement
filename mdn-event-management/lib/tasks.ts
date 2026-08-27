import { prisma } from "@/lib/prisma";
import { recalculateEventTotalBudget } from "@/lib/events";

type createTaskInput = {
    name: string;
    description: string;
    deadline: Date;
    managerIds?: number[];
    eventId?: number | null;
    budget?: number | null;
}

export async function createTask(input: createTaskInput) {
    return prisma.$transaction(async (tx) => {
        const task = await tx.task.create({
            data: {
                name: input.name,
                description: input.description,
                deadline: input.deadline,
                budget: input.budget ?? undefined,
                event: input.eventId != null ? { connect: { eventId: input.eventId } } : undefined,
                bookable: { create: { bookableType: "Task" }},
                taskManagers: input.managerIds?.length
                    ? { create: input.managerIds.map((memberId: number) => ({ memberId }))}
                    : undefined,
            },
            include: {
                bookable: true,
                taskManagers: { include: { member: true } }
            }
        });

        if (input.eventId) {
            await recalculateEventTotalBudget(tx, input.eventId);
        }

        return task;
    });
}

export async function listTasks(filter?: { eventId?: number }) {
    return prisma.task.findMany({
        where: filter?.eventId !== undefined ? { eventId: filter.eventId } : undefined,
        orderBy: { deadline: "asc" },
        include: {
            bookable: true,
            taskManagers: { include: { member: true } }
        }
    })
}

export async function readTask(taskId: number) {
    return prisma.task.findUnique({
        where: { taskId },
        include: {
            bookable: true,
            taskManagers: { include: { member: true } }
        }
    })
}

type updateTaskInput = {
    name?: string;
    description?: string | null;
    deadline?: Date;
    eventId?: number | null;
    budget?: number | null;
}

export async function updateTask(taskId: number, input: updateTaskInput) {
    return prisma.$transaction(async (tx) => {
        const previous = await tx.task.findUniqueOrThrow({
            where: { taskId },
            select: { eventId: true },
        });

        const task = await tx.task.update({
            where: { taskId },
            data: {
                name: input.name,
                description: input.description,
                deadline: input.deadline,
                budget: input.budget,
                event: input.eventId === undefined
                    ? undefined
                    : input.eventId === null
                        ? { disconnect: true }
                        : { connect: { eventId: input.eventId } },
            },
            include: {
                bookable: true,
                taskManagers: { include: { member: true } },
            }
        });

        const budgetOrEventChanged = input.budget !== undefined || input.eventId !== undefined;
        if (budgetOrEventChanged && task.eventId) {
            await recalculateEventTotalBudget(tx, task.eventId);
        }
        if (previous.eventId && previous.eventId !== task.eventId) {
            await recalculateEventTotalBudget(tx, previous.eventId);
        }

        return task;
    });
}

export async function deleteTask(taskId: number) {
    // Ensure task exists before delete attempt
    const task = await prisma.task.findUniqueOrThrow({
        where: { taskId },
        select: {
            bookableId: true,
            eventId: true,
        },
    });

    return prisma.$transaction(async (tx) => {
        // delete all associated task managers
        await tx.taskManager.deleteMany({ where: { taskId } });

        // delete all associated allocations that are linked to task
        await tx.resourceAllocation.deleteMany({
            where: { bookableId: task.bookableId },
        });

        // delete task itself
        await tx.task.delete({ where: { taskId } });

        // delete associated bookable object
        await tx.bookable.delete({
            where: { bookableId: task.bookableId },
        });

        // reflect the removed budget in the event's total, if any
        if (task.eventId) {
            await recalculateEventTotalBudget(tx, task.eventId);
        }
    });
}

