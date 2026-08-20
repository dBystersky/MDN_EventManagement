"use server";

import { revalidatePath } from "next/cache";
import { createTask, deleteTask, parseDeadline, parseMemberIds } from "@/lib/tasks";

export async function createTaskAction(formData: FormData) {
  const name = formData.get("name") as string;
  const description = (formData.get("description") as string) || "";
  const deadline = parseDeadline(formData.get("deadline"));
  const managerIds = parseMemberIds(formData.getAll("memberIds")) ?? [];

  if (!name || !deadline) return;

  await createTask({
    name,
    description,
    deadline,
    managerIds,
  });

  revalidatePath("/test-tasks");
}

export async function deleteTaskAction(id: number) {
  await deleteTask(id);
  revalidatePath("/test-tasks");
}
