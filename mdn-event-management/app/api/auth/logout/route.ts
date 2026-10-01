import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, getAuthSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

export async function POST() {
  const session = await getAuthSession();
  if (session) {
    await recordAudit({
      actor: session,
      action: "logout",
      entityType: "Member",
      entityId: session.member_id,
      summary: `${session.email} logged out`,
    });
  }

  const response = NextResponse.json({
    message: "Logged out successfully",
  });

  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    path: "/",
    expires: new Date(0),
  });

  return response;
}
