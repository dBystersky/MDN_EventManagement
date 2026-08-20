import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import {
    deleteTask,
    parseDeadline,
    parseMemberIds,
    parseTaskId,
    readTask,
    updateTask,
} from "@/lib/tasks";

type RouteParams = {
    params: Promise<{ taskId: string }>;
};

export async function GET(_request: Request, context: RouteParams) {
    const { taskId } = await context.params;
    const id = parseTaskId(taskId);

    if (!id) {
        return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
    }

    try {
        const task = await readTask(id);
        if (!task) {
            return NextResponse.json({ error: `Task not found` }, { status: 404 });
        }
        return NextResponse.json(task, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: `Task not found: ${error}` }, { status: 404 });
    }
}

export async function PATCH(request: Request, context: RouteParams) {
    const { taskId } = await context.params;
    const id = parseTaskId(taskId);

    if (!id) {
        return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
    }

    try {
        const body = await request.json();
        const managerIds =
            body.managerIds !== undefined || body.memberIds !== undefined
                ? parseMemberIds(body.managerIds ?? body.memberIds)
                : undefined;

        if (body.name !== undefined && (typeof body.name !== "string" || body.name.trim() === "")) {
            return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
        }

        if (body.deadline !== undefined && !parseDeadline(body.deadline)) {
            return NextResponse.json({ error: "A valid deadline is required" }, { status: 400 });
        }

        if (managerIds === null) {
            return NextResponse.json(
                { error: "managerIds must be an array of positive integers" },
                { status: 400 }
            );
        }

        const task = await updateTask(id, {
            name: typeof body.name === "string" ? body.name.trim() : undefined,
            description:
                body.description !== undefined
                    ? typeof body.description === "string" && body.description.trim() !== ""
                        ? body.description.trim()
                        : null
                    : undefined,
            deadline: body.deadline !== undefined ? parseDeadline(body.deadline) ?? undefined : undefined,
            managerIds,
        });

        return NextResponse.json(task, { status: 200 });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
            return NextResponse.json({ error: `Task not found: ${error}` }, { status: 404 });
        }
        return NextResponse.json({ error: `Failed to update task: ${error}` }, { status: 500 });
    }
}

export async function DELETE(_request: Request, context: RouteParams) {
    const { taskId } = await context.params;
    const id = parseTaskId(taskId);

    if (!id) {
        return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
    }

    try {
        await deleteTask(id);
        return NextResponse.json({ message: "Task deleted successfully" }, { status: 200 });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
            return NextResponse.json({ error: `Task not found: ${error}` }, { status: 404 });
        }
        return NextResponse.json({ error: `Failed to delete task ${error}` }, { status: 500 });
    }
}
