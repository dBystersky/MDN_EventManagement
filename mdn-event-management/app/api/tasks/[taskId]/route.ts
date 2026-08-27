import { NextResponse } from "next/server";
import { readTask, deleteTask, updateTask } from "@/lib/tasks";
import { Prisma } from "@/generated/prisma/client";

type RouteParams = {
    params: Promise<{ taskId: string }>;
}

// Function to get individual task from the API
export async function GET(request: Request, context: RouteParams) {
    // Extract the taskId from the URL parameters
    const { taskId } = await context.params;
    const id  = Number(taskId);

    try {
        // Get the task from the database
        const task = await readTask(id);

        // Return the found task
        return NextResponse.json(task, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: `Task not found: ${error}` }, { status: 404 });
    }

}

export async function PATCH(request: Request, context: RouteParams) {
    // Extract the taskId from the URL parameters
    const { taskId } = await context.params;
    const id = Number(taskId);

    // Extract the params to update task with
    const body = await request.json();

    if (body.budget !== undefined && body.budget !== null && Number(body.budget) < 0) {
        return NextResponse.json({ error: "budget must not be negative" }, { status: 400 });
    }

    try {
        // Update the task
        const task = await updateTask(id, {
            name: body.name,
            description: body.description,
            deadline: body.deadline !== undefined ? new Date(body.deadline) : undefined,
            eventId: body.eventId,
            budget: body.budget,
        });

        // Return the updated task
        return NextResponse.json(task, { status: 200 });
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError
        ) {
            if (error.code === 'P2025') {
                return NextResponse.json({ error: `Task not found: ${error}` }, { status: 404 });
            }
        }

        return NextResponse.json({ error: `Failed to update task: ${error}` }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: RouteParams){
    const { taskId } = await context.params;
    const id = Number(taskId);

    try {
        // Delete the task
        await deleteTask(id);

        // Return a success message
        return NextResponse.json({ message: "Task deleted successfully" }, { status: 200 });

    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2025') {
                return NextResponse.json({ error: `Task not found: ${error}` }, { status: 404 });
            }
        }
        return NextResponse.json({ error: `Failed to delete task ${error}` }, { status: 500 });
    }
}
