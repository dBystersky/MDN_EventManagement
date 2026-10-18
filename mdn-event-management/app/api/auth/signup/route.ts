import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { MemberRole } from "@/generated/prisma/client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 },
      );
    }

    // Check if user already exists
    const existingMember = await prisma.member.findUnique({
      where: { email },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: "A member with this email already exists" },
        { status: 400 },
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Self-service signup is always a plain Member; an Executive promotes
    // people from the members page. (Trusting a client-sent role here would
    // let anyone sign themselves up as Executive.)
    const memberRole: MemberRole = MemberRole.Member;

    // Create member
    const newMember = await prisma.member.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: memberRole,
      },
    });

    const userSession = {
      member_id: newMember.memberId,
      email: newMember.email,
      name: newMember.name,
      role: newMember.role,
    };

    const token = signToken(userSession);

    await recordAudit({
      actor: userSession,
      action: "signup",
      entityType: "Member",
      entityId: newMember.memberId,
      summary: `${newMember.email} signed up as ${newMember.role}`,
    });

    const response = NextResponse.json({
      message: "Signed up successfully",
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
    console.error("Signup error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
