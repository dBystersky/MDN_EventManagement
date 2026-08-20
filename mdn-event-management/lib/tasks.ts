import { prisma } from "@/lib/prisma";

export const taskInclude = {
    taskManagers: {
        include: {
            member: true,
        },
    },
    bookable: true,
} as const;

export function parseTaskId(value: string): number | null {
    if (!/^\d+$/.test(value)) {
        return null;
    }

    const taskId = Number.parseInt(value, 10);
    if (!Number.isInteger(taskId) || taskId <= 0) {
        return null;
    }
    return taskId;
}

export function parseDeadline(value: unknown): Date | null {
    if (typeof value !== "string" || value.trim() === "") {
        return null;
    }

    const deadline = new Date(value);
    if (Number.isNaN(deadline.getTime())) {
        return null;
    }

    return deadline;
}

export function parseMemberIds(value: unknown): number[] | null {
    if (value === undefined) {
        return [];
    }

    if (!Array.isArray(value)) {
        return null;
    }

    const memberIds: number[] = [];
    for (const id of value) {
        const raw = String(id);
        if (!/^\d+$/.test(raw)) {
            return null;
        }
        const parsed = Number.parseInt(raw, 10);
        if (!Number.isInteger(parsed) || parsed <= 0) {
            return null;
        }
        memberIds.push(parsed);
    }

    return [...new Set(memberIds)];
}

type createTaskInput = {
    name: string;
    description?: string | null;
    deadline: Date;
    managerIds?: number[];
};

export async function createTask(input: createTaskInput) {
    return prisma.task.create({
        data: {
            name: input.name,
            description: input.description ?? null,
            deadline: input.deadline,
            bookable: { create: { bookableType: "Task" } },
            taskManagers: input.managerIds?.length
                ? { create: input.managerIds.map((memberId: number) => ({ memberId })) }
                : undefined,
        },
        include: taskInclude,
    });
}

export async function listTasks() {
    return prisma.task.findMany({
        orderBy: { deadline: "asc" },
        include: taskInclude,
    });
}

export async function readTask(taskId: number) {
    return prisma.task.findUnique({
        where: { taskId },
        include: taskInclude,
    });
}

type updateTaskInput = {
    name?: string;
    description?: string | null;
    deadline?: Date;
    managerIds?: number[];
};

export async function updateTask(taskId: number, input: updateTaskInput) {
    if (input.managerIds !== undefined) {
        await prisma.taskManager.deleteMany({ where: { taskId } });
        if (input.managerIds.length > 0) {
            await prisma.taskManager.createMany({
                data: input.managerIds.map((memberId) => ({ memberId, taskId })),
            });
        }
    }

    return prisma.task.update({
        where: { taskId },
        data: {
            name: input.name,
            description: input.description,
            deadline: input.deadline,
        },
        include: taskInclude,
    });
}

export async function deleteTask(taskId: number) {
    const task = await prisma.task.findUniqueOrThrow({
        where: { taskId },
        select: { bookableId: true },
    });

    return prisma.$transaction(async (tx) => {
        await tx.taskManager.deleteMany({ where: { taskId } });
        await tx.resourceAllocation.deleteMany({
            where: { bookableId: task.bookableId },
        });
        await tx.task.delete({ where: { taskId } });
        await tx.bookable.delete({
            where: { bookableId: task.bookableId },
        });
    });
}
