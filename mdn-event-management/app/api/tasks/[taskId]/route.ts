import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  deleteTask,
  parseDeadline,
  parseMemberIds,
  parseTaskId,
  taskInclude,
} from '@/lib/tasks';

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { taskId: taskIdParam } = await context.params;
    const taskId = parseTaskId(taskIdParam);

    if (!taskId) {
      return NextResponse.json({ error: 'Invalid task id' }, { status: 400 });
    }

    const task = await prisma.task.findUnique({
      where: { taskId },
      include: taskInclude,
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (error) {
    console.error('Get task error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { taskId: taskIdParam } = await context.params;
    const taskId = parseTaskId(taskIdParam);

    if (!taskId) {
      return NextResponse.json({ error: 'Invalid task id' }, { status: 400 });
    }

    const existing = await prisma.task.findUnique({
      where: { taskId },
      select: { taskId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const body = await request.json();
    const data: {
      name?: string;
      description?: string | null;
      deadline?: Date;
    } = {};

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim() === '') {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
      }
      data.name = body.name.trim();
    }

    if (body.description !== undefined) {
      data.description =
        typeof body.description === 'string' && body.description.trim() !== ''
          ? body.description.trim()
          : null;
    }

    if (body.deadline !== undefined) {
      const deadline = parseDeadline(body.deadline);
      if (!deadline) {
        return NextResponse.json(
          { error: 'A valid deadline is required' },
          { status: 400 }
        );
      }
      data.deadline = deadline;
    }

    if (body.memberIds !== undefined) {
      const memberIds = parseMemberIds(body.memberIds);
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

      await prisma.taskManager.deleteMany({ where: { taskId } });
      if (memberIds.length > 0) {
        await prisma.taskManager.createMany({
          data: memberIds.map((memberId) => ({ memberId, taskId })),
        });
      }
    }

    const task = await prisma.task.update({
      where: { taskId },
      data,
      include: taskInclude,
    });

    return NextResponse.json({ task });
  } catch (error) {
    console.error('Update task error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { taskId: taskIdParam } = await context.params;
    const taskId = parseTaskId(taskIdParam);

    if (!taskId) {
      return NextResponse.json({ error: 'Invalid task id' }, { status: 400 });
    }

    const deleted = await deleteTask(taskId);

    if (!deleted) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Task deleted' });
  } catch (error) {
    console.error('Delete task error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
