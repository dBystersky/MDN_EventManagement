import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, getAuthSession } from '@/lib/auth';
import { MemberRole } from '@/generated/prisma/client';

/** Only Admin sessions may call these handlers. */
async function requireAdmin() {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  if (session.role !== 'Admin') {
    return NextResponse.json({ error: 'Forbidden — Admin only' }, { status: 403 });
  }
  return null; // OK
}

/** POST /api/admin/members — create a new member (Admin only) */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { name, email, password, role } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      );
    }

    const existing = await prisma.member.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: 'A member with this email already exists' },
        { status: 400 }
      );
    }

    let memberRole: MemberRole = MemberRole.Member;
    if (role === 'Manager') memberRole = MemberRole.Manager;
    if (role === 'Admin') memberRole = MemberRole.Admin;
    if (role === 'Guest') memberRole = MemberRole.Guest;

    const member = await prisma.member.create({
      data: {
        name,
        email,
        password: await hashPassword(password),
        role: memberRole,
      },
      select: { memberId: true, name: true, email: true, role: true },
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error('Create member error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
