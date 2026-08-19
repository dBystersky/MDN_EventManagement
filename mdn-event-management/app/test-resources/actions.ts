"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// CREATE: Add a new Resource Type
export async function createResourceType(formData: FormData) {
  const name = formData.get("name") as string;

  if (!name) return;

  await prisma.resourceType.create({
    data: { name },
  });

  revalidatePath("/test-db"); // Refresh the page to show new data
}

// DELETE: Remove a Resource Type
export async function deleteResourceType(id: number) {
  await prisma.resourceType.delete({
    where: { typeId: id },
  });

  revalidatePath("/test-db"); // Refresh the page
}
