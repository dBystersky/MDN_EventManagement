import { NextResponse } from "next/server";
import { createTask, listTasks } from "@/lib/tasks";
import { Prisma } from "@/generated/prisma/client";

// Function to get all tasks from the API
export async function GET() {
    try {
        const tasks = await listTasks();
        return NextResponse.json(tasks, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: `Failed to get tasks: ${error}` }, { status: 500 });
    }
}

// Function to create a new task
export async function POST(request: Request) {
    const body = await request.json();

    try {
        const newTask = await createTask({
            name: body.name,
            description: body.description,
            deadline: new Date(body.deadline),
            managerIds: body.managerIds,
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
