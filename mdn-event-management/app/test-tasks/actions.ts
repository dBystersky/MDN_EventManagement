"use server";

import { revalidatePath } from "next/cache";
import { createTask, deleteTask, parseDeadline, parseMemberIds, updateTask } from "@/lib/tasks";

const TEST_PATH = "/test-tasks";

export async function createTaskAction(formData: FormData) {
    const name = (formData.get("name") as string | null)?.trim();
    const description = (formData.get("description") as string | null)?.trim() || null;
    const deadline = parseDeadline(formData.get("deadline"));
    const managerIds = parseMemberIds(formData.getAll("memberIds"));

    if (!name || !deadline || managerIds === null) return;

    await createTask({ name, description, deadline, managerIds });
    revalidatePath(TEST_PATH);
}

export async function updateTaskAction(formData: FormData) {
    const taskId = Number(formData.get("taskId"));
    const name = (formData.get("name") as string | null)?.trim();
    const descriptionRaw = formData.get("description");
    const deadline = parseDeadline(formData.get("deadline"));
    const managerIds = parseMemberIds(formData.getAll("memberIds"));

    if (!Number.isInteger(taskId) || taskId <= 0 || !name || !deadline || managerIds === null) {
        return;
    }

    await updateTask(taskId, {
        name,
        description:
            typeof descriptionRaw === "string" && descriptionRaw.trim() !== ""
                ? descriptionRaw.trim()
                : null,
        deadline,
        managerIds,
    });

    revalidatePath(TEST_PATH);
}

export async function deleteTaskAction(id: number) {
    await deleteTask(id);
    revalidatePath(TEST_PATH);
}
