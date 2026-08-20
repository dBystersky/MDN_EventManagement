import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { prisma } from "../lib/prisma.ts";

const BASE = process.env.TASK_API_BASE ?? "http://localhost:3000/api/tasks";

type Task = {
  taskId: number;
  name: string;
  description: string | null;
  deadline: string;
  bookableId: number;
  bookable?: { bookableId: number; bookableType: string };
  taskManagers?: Array<{ memberId: number; taskId: number }>;
};

function asTask(json: unknown): Task {
  return json as Task;
}

async function api(method: string, path = "", body?: unknown) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json();
  return { status: response.status, json };
}

describe("Task CRUD API", () => {
  let memberA: number;
  const createdTaskIds: number[] = [];

  before(async () => {
    const health = await fetch(BASE).catch(() => null);
    if (!health) {
      throw new Error(`API not reachable at ${BASE}. Start the app with: npm run dev`);
    }

    const stamp = Date.now();
    const a = await prisma.member.create({
      data: {
        name: "Task Tester A",
        role: "Member",
        email: `task-tester-a-${stamp}@mdn.test`,
        password: "test-hash",
      },
    });
    memberA = a.memberId;
  });

  after(async () => {
    for (const taskId of createdTaskIds) {
      await api("DELETE", `/${taskId}`).catch(() => undefined);
    }
    await prisma.taskManager.deleteMany({ where: { memberId: memberA } });
    await prisma.member.deleteMany({ where: { memberId: memberA } });
    await prisma.$disconnect();
  });

  it("POST creates a task with linked bookable", async () => {
    const { status, json } = await api("POST", "", {
      name: "Order PCB",
      description: "Rev A boards",
      deadline: "2026-09-15T17:00:00.000Z",
    });
    const task = asTask(json);

    assert.equal(status, 201);
    assert.equal(task.name, "Order PCB");
    assert.equal(task.description, "Rev A boards");
    assert.equal(task.bookable?.bookableType, "Task");
    assert.ok(task.taskId);
    createdTaskIds.push(task.taskId);
  });

  it("POST creates a task with manager assignments", async () => {
    const { status, json } = await api("POST", "", {
      name: "Assigned task",
      description: "",
      deadline: "2026-10-01T12:00:00.000Z",
      managerIds: [memberA],
    });
    const task = asTask(json);

    assert.equal(status, 201);
    assert.equal(task.taskManagers?.length, 1);
    assert.equal(task.taskManagers?.[0]?.memberId, memberA);
    createdTaskIds.push(task.taskId);
  });

  it("GET lists tasks", async () => {
    const { status, json } = await api("GET");
    assert.equal(status, 200);
    assert.ok(Array.isArray(json));
  });

  it("GET returns a single task by [taskId]", async () => {
    const created = await api("POST", "", {
      name: "Fetch me",
      description: "",
      deadline: "2026-11-01T00:00:00.000Z",
    });
    const taskId = asTask(created.json).taskId;
    createdTaskIds.push(taskId);

    const { status, json } = await api("GET", `/${taskId}`);
    const task = asTask(json);
    assert.equal(status, 200);
    assert.equal(task.taskId, taskId);
    assert.equal(task.name, "Fetch me");
  });

  it("PATCH updates name, description, and deadline", async () => {
    const created = await api("POST", "", {
      name: "Before",
      description: "old",
      deadline: "2026-08-01T00:00:00.000Z",
    });
    const taskId = asTask(created.json).taskId;
    createdTaskIds.push(taskId);

    const { status, json } = await api("PATCH", `/${taskId}`, {
      name: "After",
      description: "new",
      deadline: "2026-12-01T00:00:00.000Z",
    });
    const task = asTask(json);

    assert.equal(status, 200);
    assert.equal(task.name, "After");
    assert.equal(task.description, "new");
    assert.equal(task.deadline, "2026-12-01T00:00:00.000Z");
  });

  it("PATCH returns 404 for unknown task", async () => {
    const { status } = await api("PATCH", "/999999", { name: "Nope" });
    assert.equal(status, 404);
  });

  it("DELETE removes task, bookable, and returns 404 afterwards", async () => {
    const created = await api("POST", "", {
      name: "Delete me",
      description: "",
      deadline: "2026-08-01T00:00:00.000Z",
    });
    const createdTask = asTask(created.json);
    const taskId = createdTask.taskId;
    const bookableId = createdTask.bookableId;

    const deleted = await api("DELETE", `/${taskId}`);
    assert.equal(deleted.status, 200);
    assert.equal(deleted.json.message, "Task deleted successfully");

    const bookable = await prisma.bookable.findUnique({
      where: { bookableId },
    });
    assert.equal(bookable, null);

    const again = await api("DELETE", `/${taskId}`);
    assert.equal(again.status, 404);
  });
});
