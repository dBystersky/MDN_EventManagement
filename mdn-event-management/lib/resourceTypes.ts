import { prisma } from "@/lib/prisma";

export async function createResourceType(name: string) {
    return prisma.resourceType.create({
        data: { name },
    });
}

export async function listResourceTypes() {
    return prisma.resourceType.findMany({
        orderBy: { name: "asc" },
    });
}

export async function getResourceType(typeId: number) {
    return prisma.resourceType.findUnique({
        where: { typeId },
    });
}

export async function updateResourceType(typeId: number, name: string) {
    return prisma.resourceType.update({
        where: { typeId },
        data: { name },
    });
}

export async function deleteResourceType(typeId: number) {
    await prisma.resourceType.findUniqueOrThrow({
        where: { typeId },
    });

    return prisma.$transaction(async (tx) => {
        const resources = await tx.resource.findMany({
            where: { resourceType: typeId },
            select: { resourceId: true },
        });
        const resourceIds = resources.map((r) => r.resourceId);

        await tx.resourceAllocation.deleteMany({
            where: { resourceId: { in: resourceIds } },
        });
        await tx.resource.deleteMany({
            where: { resourceType: typeId },
        });
        await tx.resourceType.delete({
            where: { typeId },
        });
    });
}
