import { redirect } from "next/navigation";

import { getAuthSession } from "@/lib/auth";
import { canViewAuditLog } from "@/lib/permissions";
import AuditLogClient from "./audit-log-client";

export default async function AuditLogPage() {
  const session = await getAuthSession();
  if (!canViewAuditLog(session?.role)) {
    redirect("/events");
  }
  return <AuditLogClient />;
}
