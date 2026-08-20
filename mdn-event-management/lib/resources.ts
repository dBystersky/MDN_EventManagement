import { prisma } from "@/lib/prisma";

type createResourceInput = {
    name: string;
    resourceTypeId: number;
}

export async function createResource(input: createResourceInput) {
    return prisma.resource.create({
        data: {
            name: input.name,
            resourceType: input.resourceTypeId,
        },
        include: {
            resourceTypeRel: true,
        }
    });
}

export async function listResources() {
    return prisma.resource.findMany({
        orderBy: { name: "asc" },
        include: {
            resourceTypeRel: true,
        }
    });
}

export async function getResource(resourceId: number) {
    return prisma.resource.findUnique({
        where: { resourceId },
        include: {
            resourceTypeRel: true,
        }
    });
}

type updateResourceInput = {
    name?: string;
    resourceTypeId?: number;
}

export async function updateResource(resourceId: number, input: updateResourceInput) {
    return prisma.resource.update({
        where: { resourceId },
        data: {
            name: input.name,
            ...(input.resourceTypeId !== undefined
                ? { resourceType: input.resourceTypeId }
                : {}),
        },
        include: {
            resourceTypeRel: true,
        }
    });
}

export async function deleteResource(resourceId: number) {
    await prisma.resource.findUniqueOrThrow({
        where: { resourceId },
    });

    return prisma.$transaction(async (tx) => {
        await tx.resourceAllocation.deleteMany({
            where: { resourceId },
        });
        await tx.resource.delete({
            where: { resourceId },
        });
    });
}
