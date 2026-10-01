import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { canViewAuditLog } from "@/lib/permissions";
import { listAuditLogs } from "@/lib/audit";

// Audit trail, newest first. Optional filters: ?entityType=Task&entityId=3&take=50
export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!canViewAuditLog(session.role)) {
    return NextResponse.json(
      { error: "Forbidden — the audit log is for admins only" },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const entityId = searchParams.get("entityId");
  const take = searchParams.get("take");

  try {
    const logs = await listAuditLogs({
      entityType: searchParams.get("entityType") ?? undefined,
      entityId: entityId !== null ? Number(entityId) : undefined,
      take: take !== null ? Number(take) : undefined,
    });
    return NextResponse.json(logs, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: `Failed to get audit log: ${error}` }, { status: 500 });
  }
}
