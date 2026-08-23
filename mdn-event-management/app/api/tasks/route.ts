import { NextResponse } from "next/server";
import { createTask, listTasks } from "@/lib/tasks";
import { Prisma } from "@/generated/prisma/client";

// Function to get all tasks from the API
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const eventIdParam = searchParams.get("eventId");

    try {
        const tasks = await listTasks(
            eventIdParam !== null ? { eventId: Number(eventIdParam) } : undefined
        );
        return NextResponse.json(tasks, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: `Failed to get tasks: ${error}` }, { status: 500 });
    }
}

// Function to create a new task
export async function POST(request: Request) {
    const body = await request.json();

    if (body.budget !== undefined && body.budget !== null && Number(body.budget) < 0) {
        return NextResponse.json({ error: "budget must not be negative" }, { status: 400 });
    }

    try {
        const newTask = await createTask({
            name: body.name,
            description: body.description,
            deadline: new Date(body.deadline),
            managerIds: body.managerIds,
            eventId: body.eventId,
            budget: body.budget,
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
                { status: 500 }
              );
        }
        return NextResponse.json({ error: `Failed to create task: ${error}` }, { status: 500 });
    }

}
