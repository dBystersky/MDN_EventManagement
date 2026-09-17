import { prisma } from "@/lib/prisma";

export const memberPublicSelect = {
    memberId: true,
    name: true,
    email: true,
    role: true,
} as const;

export async function listMembers() {
    return prisma.member.findMany({
        orderBy: { name: "asc" },
        select: memberPublicSelect,
    });
}
