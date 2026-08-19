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


export async function createResource(formData: FormData) {
  const name = formData.get("name") as string;
  const resourceTypeId = Number(formData.get("resourceTypeId"));

  if (!name || !resourceTypeId) return;

  await prisma.resource.create({
    data: { 
      name, 
      resourceType: resourceTypeId // Mapping to your relation field
    },
  });

  revalidatePath("/test-db");
}

// DELETE: Remove a Resource
export async function deleteResource(id: number) {
  await prisma.resource.delete({
    where: { resourceId: id },
  });

  revalidatePath("/test-db");
}

export async function createLocation(formData: FormData) {
  const name = formData.
    get("name") as string;

  if (!name) return;

  await prisma.location.create({
    data: { name },
  });

  revalidatePath("/test-db"); // Refresh the page to show new data
}

// DELETE: Remove a Location
export async function deleteLocation(id: number) {
  await prisma.location.delete({
    where: { locationId: id },
  });

  revalidatePath("/test-db"); // Refresh the page
}