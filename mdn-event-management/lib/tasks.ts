import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { recalculateEventTotalBudget } from "@/lib/events";
import { memberPublicSelect } from "@/lib/members";
import { shiftBookableAllocations } from "@/lib/resourceAllocations";
import type { TaskStatus } from "@/lib/permissions";

const taskInclude = {
  bookable: true,
  taskManagers: { include: { member: { select: memberPublicSelect } } },
} as const;

type createTaskInput = {
  name: string;
  description: string;
  deadline: Date;
  managerIds?: number[];
  eventId?: number | null;
  budget?: number | null;
  status?: TaskStatus;
};

export async function createTask(input: createTaskInput) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        name: input.name,
        description: input.description,
        deadline: input.deadline,
        budget: input.budget ?? undefined,
        status: input.status,
        event: input.eventId != null ? { connect: { eventId: input.eventId } } : undefined,
        bookable: { create: { bookableType: "Task" } },
        taskManagers: input.managerIds?.length
          ? { create: input.managerIds.map((memberId: number) => ({ memberId })) }
          : undefined,
      },
      include: taskInclude,
    });

    if (input.eventId) {
      await recalculateEventTotalBudget(tx, input.eventId);
    }

    return task;
  });
}

/**
 * `memberId` narrows to what a Member may see: tasks in events they belong to,
 * or tasks they are assigned to directly.
 */
export async function listTasks(filter?: { eventId?: number; memberId?: number }) {
  const where: Prisma.TaskWhereInput = {};
  if (filter?.eventId !== undefined) where.eventId = filter.eventId;
  if (filter?.memberId !== undefined) {
    where.OR = [
      { event: { eventMembers: { some: { memberId: filter.memberId } } } },
      { taskManagers: { some: { memberId: filter.memberId } } },
    ];
  }
  return prisma.task.findMany({
    where: Object.keys(where).length ? where : undefined,
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
  eventId?: number | null;
  budget?: number | null;
  managerIds?: number[];
  status?: TaskStatus;
};

export async function updateTask(taskId: number, input: updateTaskInput) {
  return prisma.$transaction(async (tx) => {
    const previous = await tx.task.findUniqueOrThrow({
      where: { taskId },
      select: { eventId: true, deadline: true, bookableId: true },
    });

    const task = await tx.task.update({
      where: { taskId },
      data: {
        name: input.name,
        description: input.description,
        deadline: input.deadline,
        budget: input.budget,
        status: input.status,
        event:
          input.eventId === undefined
            ? undefined
            : input.eventId === null
              ? { disconnect: true }
              : { connect: { eventId: input.eventId } },
        ...(input.managerIds !== undefined
          ? {
              taskManagers: {
                deleteMany: {},
                create: input.managerIds.map((memberId) => ({ memberId })),
              },
            }
          : {}),
      },
      include: taskInclude,
    });

    // A task's bookings hang off its deadline, so they move with it —
    // otherwise they drift, and clash detection then reports the resource as
    // held at a time nobody is working.
    if (input.deadline !== undefined) {
      await shiftBookableAllocations(
        tx,
        previous.bookableId,
        input.deadline.getTime() - previous.deadline.getTime(),
      );
    }

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
