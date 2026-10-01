import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { UserSession } from "@/lib/auth";

export type AuditAction =
  "create" | "update" | "delete" | "login" | "logout" | "signup" | "login_failed";
export type AuditEntity =
  "Event" | "Task" | "ResourceAllocation" | "Resource" | "ResourceType" | "Location" | "Member";

type RecordAuditInput = {
  actor: UserSession | null;
  action: AuditAction;
  entityType: AuditEntity;
  entityId: number;
  summary: string;
  changes?: Prisma.InputJsonValue;
};

/**
 * Records one audit entry in the database. Never throws: the change being
 * audited has already been committed, so a failed log write must not turn it
 * into a 500.
 */
export async function recordAudit(input: RecordAuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actor?.member_id ?? null,
        actorName: input.actor?.name ?? "Unknown",
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        summary: input.summary,
        changes: input.changes,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log", error);
  }
}

/** The fields a PATCH body actually touched, ignoring `undefined` keys. */
export function changedFields(body: Record<string, unknown>) {
  return Object.keys(body).filter((key) => body[key] !== undefined);
}

export async function listAuditLogs(filter: {
  entityType?: string;
  entityId?: number;
  take?: number;
}) {
  return prisma.auditLog.findMany({
    where: {
      entityType: filter.entityType,
      entityId: filter.entityId,
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(filter.take ?? 100, 1), 200),
  });
}

/**
 * Deletes cascade: removing a resource also removes its allocations, a location
 * its events, and so on. Those rows vanish without passing through their own
 * routes, so callers snapshot them before the delete and log each one here.
 */
export type Dependent = { id: number; label: string };

export async function findAllocationDependents(
  where: Prisma.ResourceAllocationWhereInput,
): Promise<Dependent[]> {
  const rows = await prisma.resourceAllocation.findMany({
    where,
    select: { allocationId: true, resourceId: true },
  });
  return (rows ?? []).map((r) => ({
    id: r.allocationId,
    label: `allocation #${r.allocationId} (resource #${r.resourceId})`,
  }));
}

export async function recordCascade(
  actor: UserSession | null,
  action: "delete" | "update",
  entityType: AuditEntity,
  dependents: Dependent[],
  because: string,
) {
  for (const dep of dependents) {
    await recordAudit({
      actor,
      action,
      entityType,
      entityId: dep.id,
      summary: `${action === "delete" ? "Deleted" : "Unlinked"} ${dep.label} — ${because}`,
    });
  }
}
