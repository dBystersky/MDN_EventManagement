import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { prisma } from '../lib/prisma.ts';

const BASE = process.env.TASK_API_BASE ?? 'http://localhost:3000/api/tasks';

type TaskResponse = {
  task?: {
    taskId: number;
    name: string;
    description: string | null;
    deadline: string;
    bookableId: number;
    bookable?: { bookableId: number; bookableType: string };
    taskManagers?: Array<{
      memberId: number;
      taskId: number;
      member?: { memberId: number; name: string; email: string };
    }>;
  };
  tasks?: unknown[];
  error?: string;
  message?: string;
};

async function api(
  method: string,
  path = '',
  body?: unknown
): Promise<{ status: number; json: TaskResponse }> {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = (await response.json()) as TaskResponse;
  return { status: response.status, json };
}

describe('Task CRUD API', () => {
  let memberA: number;
  let memberB: number;
  const createdTaskIds: number[] = [];

  before(async () => {
    const health = await fetch(BASE).catch(() => null);
    if (!health) {
      throw new Error(
        `API not reachable at ${BASE}. Start the app with: npm run dev`
      );
    }

    const stamp = Date.now();
    const a = await prisma.member.create({
      data: {
        name: 'Task Tester A',
        role: 'Member',
        email: `task-tester-a-${stamp}@mdn.test`,
        password: 'test-hash',
      },
    });
    const b = await prisma.member.create({
      data: {
        name: 'Task Tester B',
        role: 'Manager',
        email: `task-tester-b-${stamp}@mdn.test`,
        password: 'test-hash',
      },
    });
    memberA = a.memberId;
    memberB = b.memberId;
  });

  after(async () => {
    for (const taskId of createdTaskIds) {
      await api('DELETE', `/${taskId}`).catch(() => undefined);
    }

    await prisma.taskManager.deleteMany({
      where: { memberId: { in: [memberA, memberB] } },
    });
    await prisma.member.deleteMany({
      where: { memberId: { in: [memberA, memberB] } },
    });
    await prisma.$disconnect();
  });

  it('POST creates a task with linked bookable', async () => {
    const { status, json } = await api('POST', '', {
      name: 'Order PCB',
      description: 'Rev A boards',
      deadline: '2026-09-15T17:00:00.000Z',
    });

    assert.equal(status, 201);
    assert.equal(json.task?.name, 'Order PCB');
    assert.equal(json.task?.description, 'Rev A boards');
    assert.equal(json.task?.bookable?.bookableType, 'task');
    assert.ok(json.task?.taskId);
    createdTaskIds.push(json.task!.taskId);
  });

  it('POST creates a task with member assignments', async () => {
    const { status, json } = await api('POST', '', {
      name: 'Assigned task',
      deadline: '2026-10-01T12:00:00.000Z',
      memberIds: [memberA, memberB],
    });

    assert.equal(status, 201);
    assert.equal(json.task?.taskManagers?.length, 2);
    const ids = json.task?.taskManagers?.map((m) => m.memberId).sort();
    assert.deepEqual(ids, [memberA, memberB].sort());
    createdTaskIds.push(json.task!.taskId);
  });

  it('POST rejects missing name', async () => {
    const { status, json } = await api('POST', '', {
      deadline: '2026-09-15T17:00:00.000Z',
    });
    assert.equal(status, 400);
    assert.match(json.error ?? '', /name/i);
  });

  it('POST rejects empty name', async () => {
    const { status } = await api('POST', '', {
      name: '   ',
      deadline: '2026-09-15T17:00:00.000Z',
    });
    assert.equal(status, 400);
  });

  it('POST rejects missing/invalid deadline', async () => {
    const missing = await api('POST', '', { name: 'No deadline' });
    assert.equal(missing.status, 400);

    const invalid = await api('POST', '', {
      name: 'Bad deadline',
      deadline: 'not-a-date',
    });
    assert.equal(invalid.status, 400);
  });

  it('POST rejects invalid memberIds payload', async () => {
    const { status } = await api('POST', '', {
      name: 'Bad members',
      deadline: '2026-09-15T17:00:00.000Z',
      memberIds: '1',
    });
    assert.equal(status, 400);
  });

  it('POST rejects nonexistent memberIds', async () => {
    const { status, json } = await api('POST', '', {
      name: 'Ghost members',
      deadline: '2026-09-15T17:00:00.000Z',
      memberIds: [999999],
    });
    assert.equal(status, 400);
    assert.match(json.error ?? '', /member/i);
  });

  it('GET lists tasks', async () => {
    const { status, json } = await api('GET');
    assert.equal(status, 200);
    assert.ok(Array.isArray(json.tasks));
    assert.ok((json.tasks?.length ?? 0) >= 1);
  });

  it('GET returns a single task by [taskId]', async () => {
    const created = await api('POST', '', {
      name: 'Fetch me',
      deadline: '2026-11-01T00:00:00.000Z',
    });
    const taskId = created.json.task!.taskId;
    createdTaskIds.push(taskId);

    const { status, json } = await api('GET', `/${taskId}`);
    assert.equal(status, 200);
    assert.equal(json.task?.taskId, taskId);
    assert.equal(json.task?.name, 'Fetch me');
  });

  it('GET returns 404 for unknown task', async () => {
    const { status } = await api('GET', '/999999');
    assert.equal(status, 404);
  });

  it('GET returns 400 for invalid taskId', async () => {
    const { status } = await api('GET', '/abc');
    assert.equal(status, 400);
  });

  it('PATCH updates name, description, and deadline', async () => {
    const created = await api('POST', '', {
      name: 'Before',
      description: 'old',
      deadline: '2026-08-01T00:00:00.000Z',
    });
    const taskId = created.json.task!.taskId;
    createdTaskIds.push(taskId);

    const { status, json } = await api('PATCH', `/${taskId}`, {
      name: 'After',
      description: 'new',
      deadline: '2026-12-01T00:00:00.000Z',
    });

    assert.equal(status, 200);
    assert.equal(json.task?.name, 'After');
    assert.equal(json.task?.description, 'new');
    assert.equal(json.task?.deadline, '2026-12-01T00:00:00.000Z');
  });

  it('PATCH can clear description', async () => {
    const created = await api('POST', '', {
      name: 'Has description',
      description: 'remove me',
      deadline: '2026-08-01T00:00:00.000Z',
    });
    const taskId = created.json.task!.taskId;
    createdTaskIds.push(taskId);

    const { status, json } = await api('PATCH', `/${taskId}`, {
      description: '',
    });
    assert.equal(status, 200);
    assert.equal(json.task?.description, null);
  });

  it('PATCH replaces member assignments', async () => {
    const created = await api('POST', '', {
      name: 'Reassign me',
      deadline: '2026-08-01T00:00:00.000Z',
      memberIds: [memberA],
    });
    const taskId = created.json.task!.taskId;
    createdTaskIds.push(taskId);

    const { status, json } = await api('PATCH', `/${taskId}`, {
      memberIds: [memberB],
    });

    assert.equal(status, 200);
    assert.equal(json.task?.taskManagers?.length, 1);
    assert.equal(json.task?.taskManagers?.[0]?.memberId, memberB);
  });

  it('PATCH clears member assignments with []', async () => {
    const created = await api('POST', '', {
      name: 'Unassign me',
      deadline: '2026-08-01T00:00:00.000Z',
      memberIds: [memberA],
    });
    const taskId = created.json.task!.taskId;
    createdTaskIds.push(taskId);

    const { status, json } = await api('PATCH', `/${taskId}`, {
      memberIds: [],
    });
    assert.equal(status, 200);
    assert.equal(json.task?.taskManagers?.length, 0);
  });

  it('PATCH rejects empty name and unknown task', async () => {
    const created = await api('POST', '', {
      name: 'Keep name',
      deadline: '2026-08-01T00:00:00.000Z',
    });
    const taskId = created.json.task!.taskId;
    createdTaskIds.push(taskId);

    const emptyName = await api('PATCH', `/${taskId}`, { name: '  ' });
    assert.equal(emptyName.status, 400);

    const missing = await api('PATCH', '/999999', { name: 'Nope' });
    assert.equal(missing.status, 404);
  });

  it('DELETE removes task and returns 404 afterwards', async () => {
    const created = await api('POST', '', {
      name: 'Delete me',
      deadline: '2026-08-01T00:00:00.000Z',
    });
    const taskId = created.json.task!.taskId;
    const bookableId = created.json.task!.bookableId;

    const deleted = await api('DELETE', `/${taskId}`);
    assert.equal(deleted.status, 200);
    assert.equal(deleted.json.message, 'Task deleted');

    const after = await api('GET', `/${taskId}`);
    assert.equal(after.status, 404);

    const bookable = await prisma.bookable.findUnique({
      where: { bookableId },
    });
    assert.equal(bookable, null);

    const again = await api('DELETE', `/${taskId}`);
    assert.equal(again.status, 404);
  });
});
