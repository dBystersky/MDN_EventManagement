import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { createTask, listTasks, parseDeadline, parseMemberIds } from "@/lib/tasks";

export async function GET() {
    try {
        const tasks = await listTasks();
        return NextResponse.json(tasks, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: `Failed to get tasks: ${error}` }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const deadline = parseDeadline(body.deadline);
        const managerIds = parseMemberIds(body.managerIds ?? body.memberIds);

        if (!name) {
            return NextResponse.json({ error: "Name is required" }, { status: 400 });
        }

        if (!deadline) {
            return NextResponse.json({ error: "A valid deadline is required" }, { status: 400 });
        }

        if (managerIds === null) {
            return NextResponse.json(
                { error: "managerIds must be an array of positive integers" },
                { status: 400 }
            );
        }

        const newTask = await createTask({
            name,
            description:
                typeof body.description === "string" ? body.description.trim() || null : null,
            deadline,
            managerIds,
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
