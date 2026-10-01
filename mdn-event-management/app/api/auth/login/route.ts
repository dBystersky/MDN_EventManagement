import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, signToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    // Find member by email
    const member = await prisma.member.findUnique({
      where: { email },
    });

    if (!member) {
      await recordAudit({
        actor: null,
        action: "login_failed",
        entityType: "Member",
        entityId: 0,
        summary: `Failed login for unknown email ${email}`,
      });
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Compare password
    const isPasswordValid = await comparePassword(password, member.password);
    if (!isPasswordValid) {
      await recordAudit({
        actor: {
          member_id: member.memberId,
          email: member.email,
          name: member.name,
          role: member.role,
        },
        action: "login_failed",
        entityType: "Member",
        entityId: member.memberId,
        summary: `Failed login (wrong password) for ${member.email}`,
      });
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const userSession = {
      member_id: member.memberId,
      email: member.email,
      name: member.name,
      role: member.role,
    };

    const token = signToken(userSession);

    await recordAudit({
      actor: userSession,
      action: "login",
      entityType: "Member",
      entityId: member.memberId,
      summary: `${member.email} logged in`,
    });

    const response = NextResponse.json({
      message: "Logged in successfully",
      user: userSession,
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
