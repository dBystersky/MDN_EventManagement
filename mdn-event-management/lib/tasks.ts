import { prisma } from "@/lib/prisma";

type createTaskInput = {
    name: string;
    description: string;
    deadline: Date;
    managerIds?: number[];
}

export async function createTask(input: createTaskInput) {
    return prisma.task.create({
        data: {
            name: input.name,
            description: input.description,
            deadline: input.deadline,
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
}

export async function listTasks() {
    return prisma.task.findMany({
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
}

export async function updateTask(taskId: number, input: updateTaskInput) {
    return prisma.task.update({
        where: { taskId },
        data: {
            name: input.name,
            description: input.description,
            deadline: input.deadline,
        },
        include: {
            bookable: true,
            taskManagers: { include: { member: true } },
        }
    })
}

export async function deleteTask(taskId: number) {
    // Ensure task exists before delete attempt
    const task = await prisma.task.findUniqueOrThrow({
        where: { taskId },
        select: {
            bookableId: true,
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
    });
}

