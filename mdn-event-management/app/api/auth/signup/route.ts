import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, signToken, AUTH_COOKIE_NAME } from '@/lib/auth';
import { MemberRole } from '@/generated/prisma/client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password, role } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingMember = await prisma.member.findUnique({
      where: { email },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: 'A member with this email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Validate role
    let memberRole: MemberRole = MemberRole.Member;
    if (role === 'Manager') memberRole = MemberRole.Manager;
    if (role === 'Admin') memberRole = MemberRole.Admin;

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

    const response = NextResponse.json({
      message: 'Signed up successfully',
      user: userSession,
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    return response;
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
