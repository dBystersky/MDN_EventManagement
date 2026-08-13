import { prisma } from '@/lib/prisma';

export const taskInclude = {
  taskManagers: {
    include: {
      member: {
        select: {
          memberId: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  },
  bookable: true,
} as const;

export function parseTaskId(value: string): number | null {
  const taskId = Number.parseInt(value, 10);
  if (!Number.isInteger(taskId) || taskId <= 0) {
    return null;
  }
  return taskId;
}

export function parseDeadline(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim() === '') {
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

  const memberIds = value.map((id) => Number.parseInt(String(id), 10));
  if (memberIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    return null;
  }

  return [...new Set(memberIds)];
}

export async function createTask(input: {
  name: string;
  description?: string | null;
  deadline: Date;
  memberIds?: number[];
}) {
  return prisma.$transaction(async (tx) => {
    const bookable = await tx.bookable.create({
      data: { bookableType: 'task' },
    });

    const task = await tx.task.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        deadline: input.deadline,
        bookableId: bookable.bookableId,
        ...(input.memberIds?.length
          ? {
              taskManagers: {
                create: input.memberIds.map((memberId) => ({ memberId })),
              },
            }
          : {}),
      },
      include: taskInclude,
    });

    return task;
  });
}

export async function deleteTask(taskId: number) {
  const existing = await prisma.task.findUnique({
    where: { taskId },
    select: { bookableId: true },
  });

  if (!existing) {
    return false;
  }

  await prisma.$transaction(async (tx) => {
    await tx.taskManager.deleteMany({ where: { taskId } });
    await tx.resourceAllocation.deleteMany({
      where: { bookableId: existing.bookableId },
    });
    await tx.task.delete({ where: { taskId } });
    await tx.bookable.delete({ where: { bookableId: existing.bookableId } });
  });

  return true;
}
