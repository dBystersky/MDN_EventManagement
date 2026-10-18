import { NextResponse } from "next/server";
import { validationFailed } from "@/lib/api-errors";
import { validateTask } from "@/lib/validation";
import { createTask, listTasks } from "@/lib/tasks";
import { Prisma } from "@/generated/prisma/client";
import { forbidden, loadTaskEventAccess, requireSession } from "@/lib/access";
import {
  canCreateTask,
  canEditBudget,
  canModifyTask,
  isMember,
  isTaskStatus,
} from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";

// Function to get all tasks from the API
export async function GET(request: Request) {
  const auth = await requireSession();
  if (auth.denied) return auth.denied;

  const { searchParams } = new URL(request.url);
  const eventIdParam = searchParams.get("eventId");

  try {
    const tasks = await listTasks({
      ...(eventIdParam !== null ? { eventId: Number(eventIdParam) } : {}),
      // Members only see tasks in their events or assigned to them.
      ...(isMember(auth.actor) ? { memberId: auth.session.member_id } : {}),
    });
    return NextResponse.json(tasks, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: `Failed to get tasks: ${error}` }, { status: 500 });
  }
}

// Function to create a new task
export async function POST(request: Request) {
  const auth = await requireSession();
  if (auth.denied) return auth.denied;
  const { session, actor } = auth;

  const body = await request.json();

  const invalid = validationFailed(validateTask(body));
  if (invalid) return invalid;

  if (body.status !== undefined && !isTaskStatus(body.status)) {
    return NextResponse.json({ error: "Invalid task status" }, { status: 400 });
  }

  try {
    const eventId = body.eventId != null ? Number(body.eventId) : null;
    const event = await loadTaskEventAccess(eventId);
    if (eventId != null && !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    if (!canCreateTask(actor, event)) {
      return forbidden("you cannot create tasks in this event");
    }
    // Only people who can modify the task may assign others to it.
    if (body.managerIds?.length && !canModifyTask(actor, event)) {
      return forbidden("you cannot assign people to tasks");
    }
    if (body.budget != null && !canEditBudget(actor)) {
      return forbidden("only executives and managers can set budgets");
    }

    const newTask = await createTask({
      name: body.name,
      description: body.description,
      deadline: new Date(body.deadline),
      managerIds: body.managerIds,
      eventId: body.eventId,
      budget: body.budget,
      status: body.status,
    });

    await recordAudit({
      actor: session,
      action: "create",
      entityType: "Task",
      entityId: newTask.taskId,
      summary: `Created task "${newTask.name}"`,
    });

    return NextResponse.json(newTask, { status: 201 });
  } catch (error) {
    console.error(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        {
          error: "Failed to create task",
          code: error.code,
          meta: error.meta,
          message: error.message,
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: `Failed to create task: ${error}` }, { status: 500 });
  }
}
