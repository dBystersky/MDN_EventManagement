import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  createTask,
  parseDeadline,
  parseMemberIds,
  taskInclude,
} from '@/lib/tasks';

export async function GET() {
  try {
    const tasks = await prisma.task.findMany({
      include: taskInclude,
      orderBy: { deadline: 'asc' },
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('List tasks error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description } = body;
    const deadline = parseDeadline(body.deadline);
    const memberIds = parseMemberIds(body.memberIds);

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!deadline) {
      return NextResponse.json(
        { error: 'A valid deadline is required' },
        { status: 400 }
      );
    }

    if (memberIds === null) {
      return NextResponse.json(
        { error: 'memberIds must be an array of positive integers' },
        { status: 400 }
      );
    }

    if (memberIds.length > 0) {
      const members = await prisma.member.findMany({
        where: { memberId: { in: memberIds } },
        select: { memberId: true },
      });

      if (members.length !== memberIds.length) {
        return NextResponse.json(
          { error: 'One or more memberIds do not exist' },
          { status: 400 }
        );
      }
    }

    const task = await createTask({
      name: name.trim(),
      description:
        typeof description === 'string' ? description.trim() || null : null,
      deadline,
      memberIds,
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error('Create task error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
