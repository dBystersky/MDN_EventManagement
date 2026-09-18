import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';

/** DELETE /api/admin/members/[id] — delete a member (Admin only) */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }
  if (session.role !== 'Admin') {
    return NextResponse.json({ error: 'Forbidden — Admin only' }, { status: 403 });
  }

  const { id } = await params;
  const memberId = parseInt(id, 10);

  if (isNaN(memberId)) {
    return NextResponse.json({ error: 'Invalid member ID' }, { status: 400 });
  }

  // Prevent admins from deleting their own account
  if (session.member_id === memberId) {
    return NextResponse.json(
      { error: 'You cannot delete your own account' },
      { status: 400 }
    );
  }

  try {
    await prisma.member.delete({ where: { memberId } });
    return NextResponse.json({ message: 'Member deleted' }, { status: 200 });
  } catch (error) {
    console.error('Delete member error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
