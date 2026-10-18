import { NextResponse } from "next/server";
import { validationFailed } from "@/lib/api-errors";
import { validateTask } from "@/lib/validation";
import { readTask, deleteTask, updateTask } from "@/lib/tasks";
import { Prisma } from "@/generated/prisma/client";
import { forbidden, loadTaskEventAccess, requireSession } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  canEditBudget,
  canModifyTask,
  canUpdateTaskDetails,
  canViewTask,
  isTaskStatus,
} from "@/lib/permissions";

/** The task's assignees and event, for permission checks. `null` = no such task. */
async function loadTaskAccess(taskId: number) {
  if (!Number.isFinite(taskId)) return null;
  const task = await prisma.task.findUnique({
    where: { taskId },
    select: { eventId: true, taskManagers: { select: { memberId: true } } },
  });
  if (!task) return null;
  return { task, event: await loadTaskEventAccess(task.eventId) };
}
import { changedFields, findAllocationDependents, recordAudit, recordCascade } from "@/lib/audit";

type RouteParams = {
  params: Promise<{ taskId: string }>;
};

// Function to get individual task from the API
export async function GET(request: Request, context: RouteParams) {
  const auth = await requireSession();
  if (auth.denied) return auth.denied;

  // Extract the taskId from the URL parameters
  const { taskId } = await context.params;
  const id = Number(taskId);

  try {
    // Get the task from the database
    const task = await readTask(id);
    if (task && !canViewTask(auth.actor, task, await loadTaskEventAccess(task.eventId))) {
      return forbidden("you are not part of this task's event");
    }

    // Return the found task
    return NextResponse.json(task, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: `Task not found: ${error}` }, { status: 404 });
  }
}

export async function PATCH(request: Request, context: RouteParams) {
  const auth = await requireSession();
  if (auth.denied) return auth.denied;
  const { session, actor } = auth;

  // Extract the taskId from the URL parameters
  const { taskId } = await context.params;
  const id = Number(taskId);

  const current = await loadTaskAccess(id);
  if (!current) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  // Extract the params to update task with
  const body = await request.json();

  const invalid = validationFailed(validateTask(body, { partial: true }));
  if (invalid) return invalid;

  if (body.status !== undefined && !isTaskStatus(body.status)) {
    return NextResponse.json({ error: "Invalid task status" }, { status: 400 });
  }

  // Details and status are open to anyone on the task; moving it between
  // events, assigning people and budgets need full rights over it.
  if (!canUpdateTaskDetails(actor, current.task, current.event)) {
    return forbidden("you cannot update this task");
  }
  const fullRights = canModifyTask(actor, current.event);
  if ((body.eventId !== undefined || body.managerIds !== undefined) && !fullRights) {
    return forbidden("you cannot move or assign this task");
  }
  if (body.budget !== undefined && !canEditBudget(actor)) {
    return forbidden("only executives and managers can set budgets");
  }
  if (body.eventId != null && Number(body.eventId) !== current.task.eventId) {
    const target = await loadTaskEventAccess(Number(body.eventId));
    if (!target) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    if (!canModifyTask(actor, target)) return forbidden("you do not manage the target event");
  }

  try {
    // Update the task
    const task = await updateTask(id, {
      name: body.name,
      description: body.description,
      deadline: body.deadline !== undefined ? new Date(body.deadline) : undefined,
      eventId: body.eventId,
      budget: body.budget,
      status: body.status,
      managerIds: Array.isArray(body.managerIds)
        ? body.managerIds.map(Number).filter((memberId: number) => Number.isFinite(memberId))
        : undefined,
    });

    const fields = changedFields(body);
    await recordAudit({
      actor: session,
      action: "update",
      entityType: "Task",
      entityId: task.taskId,
      summary: `Updated task "${task.name}"`,
      changes: { fields },
    });

    // Return the updated task
    return NextResponse.json(task, { status: 200 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: `Task not found: ${error}` }, { status: 404 });
      }
    }

    return NextResponse.json({ error: `Failed to update task: ${error}` }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteParams) {
  const auth = await requireSession();
  if (auth.denied) return auth.denied;
  const { session, actor } = auth;

  const { taskId } = await context.params;
  const id = Number(taskId);

  const current = await loadTaskAccess(id);
  if (!current) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (!canModifyTask(actor, current.event)) return forbidden("you cannot delete this task");

  try {
    const before = await readTask(id);

    // Delete the task
    const allocations = before
      ? await findAllocationDependents({ bookableId: before.bookableId })
      : [];
    await deleteTask(id);
    await recordCascade(
      session,
      "delete",
      "ResourceAllocation",
      allocations,
      `task #${id} was deleted`,
    );

    const label = before ? `"${before.name}"` : `#${id}`;
    await recordAudit({
      actor: session,
      action: "delete",
      entityType: "Task",
      entityId: id,
      summary: `Deleted task ${label}`,
    });

    // Return a success message
    return NextResponse.json({ message: "Task deleted successfully" }, { status: 200 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: `Task not found: ${error}` }, { status: 404 });
      }
    }
    return NextResponse.json({ error: `Failed to delete task ${error}` }, { status: 500 });
  }
}
