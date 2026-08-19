import { prisma } from "@/lib/prisma";

export async function createLocation(name: string) {
    return prisma.location.create({
        data: {
            name,
        }
    });
}

export async function listLocations() {
    return prisma.location.findMany({
        orderBy: { name: "asc" },
    });
}

export async function getLocation(locationId: number) {
    return prisma.location.findUnique({
        where: { locationId },
    });
}

export async function updateLocation(locationId: number, name: string) {
    return prisma.location.update({
        where: { locationId },
        data: { name },
    });
}

export async function deleteLocation(locationId: number) {
    const location = await prisma.location.findUniqueOrThrow({
        where: { locationId },
    });

    return prisma.$transaction(async (tx) => {
        // Remove all events associated with the location
        await tx.event.deleteMany({
            where: {
                location: { locationId: location.locationId },
            },
        });

        // Remove the location itself
        await tx.location.delete({
            where: { locationId },
        });
    });
}