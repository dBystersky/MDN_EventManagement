import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.ts";

const authToken = jwt.sign(
  { member_id: 1, email: "budget-test@mdn.test", name: "Budget Test", role: "Admin" },
  process.env.JWT_SECRET || "mdn_event_management_secret_key_change_in_production_2026",
  { expiresIn: "1h" },
);

const TASKS_BASE = process.env.TASK_API_BASE ?? "http://localhost:3000/api/tasks";
const EVENTS_BASE = process.env.EVENT_API_BASE ?? "http://localhost:3000/api/events";

type Task = {
  taskId: number;
  eventId: number | null;
  budget: string | null;
};

type Event = {
  eventId: number;
  totalBudget: string;
  budget?: string | null;
};

function asTask(json: unknown): Task {
  return json as Task;
}

function asEvent(json: unknown): Event {
  return json as Event;
}

async function api(base: string, method: string, path = "", body?: unknown) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      Cookie: `mdn_auth_token=${authToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json();
  return { status: response.status, json };
}

const tasksApi = (method: string, path = "", body?: unknown) => api(TASKS_BASE, method, path, body);
const eventsApi = (method: string, path = "", body?: unknown) => api(EVENTS_BASE, method, path, body);

describe("Task budget -> Event total rollup", () => {
  let locationId: number;
  let eventAId: number;
  let eventBId: number;
  const createdTaskIds: number[] = [];

  before(async () => {
    const health = await fetch(TASKS_BASE).catch(() => null);
    if (!health) {
      throw new Error(`API not reachable at ${TASKS_BASE}. Start the app with: npm run dev`);
    }

    const location = await prisma.location.create({ data: { name: `Budget Test Location ${Date.now()}` } });
    locationId = location.locationId;

    const eventA = await prisma.event.create({
      data: {
        name: "Budget Test Event A",
        description: "",
        date: new Date("2026-09-01T00:00:00.000Z"),
        budget: 10000,
        location: { connect: { locationId } },
        bookable: { create: { bookableType: "Event" } },
      },
    });
    eventAId = eventA.eventId;

    const eventB = await prisma.event.create({
      data: {
        name: "Budget Test Event B",
        description: "",
        date: new Date("2026-09-02T00:00:00.000Z"),
        budget: 10000,
        location: { connect: { locationId } },
        bookable: { create: { bookableType: "Event" } },
      },
    });
    eventBId = eventB.eventId;
  });

  after(async () => {
    for (const taskId of createdTaskIds) {
      await tasksApi("DELETE", `/${taskId}`).catch(() => undefined);
    }
    await prisma.eventManager.deleteMany({ where: { eventId: { in: [eventAId, eventBId] } } });
    const events = await prisma.event.findMany({
      where: { eventId: { in: [eventAId, eventBId] } },
      select: { bookableId: true },
    });
    await prisma.event.deleteMany({ where: { eventId: { in: [eventAId, eventBId] } } });
    await prisma.bookable.deleteMany({ where: { bookableId: { in: events.map((e) => e.bookableId) } } });
    await prisma.location.deleteMany({ where: { locationId } });
    await prisma.$disconnect();
  });

  it("creating a task with a budget adds it to the event's total", async () => {
    const created = await tasksApi("POST", "", {
      name: "Book venue",
      description: "",
      deadline: "2026-08-20T00:00:00.000Z",
      eventId: eventAId,
      budget: 150.5,
    });
    assert.equal(created.status, 201);
    createdTaskIds.push(asTask(created.json).taskId);

    const event = asEvent((await eventsApi("GET", `/${eventAId}`)).json);
    assert.equal(Number(event.totalBudget), 150.5);
  });

  it("a second task on the same event sums into the total", async () => {
    const created = await tasksApi("POST", "", {
      name: "Order catering",
      description: "",
      deadline: "2026-08-21T00:00:00.000Z",
      eventId: eventAId,
      budget: 49.5,
    });
    assert.equal(created.status, 201);
    createdTaskIds.push(asTask(created.json).taskId);

    const event = asEvent((await eventsApi("GET", `/${eventAId}`)).json);
    assert.equal(Number(event.totalBudget), 200);
  });

  it("updating a task's budget updates the event's total", async () => {
    const created = await tasksApi("POST", "", {
      name: "Rent AV equipment",
      description: "",
      deadline: "2026-08-22T00:00:00.000Z",
      eventId: eventAId,
      budget: 100,
    });
    const taskId = asTask(created.json).taskId;
    createdTaskIds.push(taskId);

    let event = asEvent((await eventsApi("GET", `/${eventAId}`)).json);
    assert.equal(Number(event.totalBudget), 300);

    await tasksApi("PATCH", `/${taskId}`, { budget: 175 });

    event = asEvent((await eventsApi("GET", `/${eventAId}`)).json);
    assert.equal(Number(event.totalBudget), 375);
  });

  it("moving a task between events updates both totals", async () => {
    const created = await tasksApi("POST", "", {
      name: "Print signage",
      description: "",
      deadline: "2026-08-23T00:00:00.000Z",
      eventId: eventAId,
      budget: 25,
    });
    const taskId = asTask(created.json).taskId;
    createdTaskIds.push(taskId);

    let eventA = asEvent((await eventsApi("GET", `/${eventAId}`)).json);
    assert.equal(Number(eventA.totalBudget), 400);

    await tasksApi("PATCH", `/${taskId}`, { eventId: eventBId });

    eventA = asEvent((await eventsApi("GET", `/${eventAId}`)).json);
    const eventB = asEvent((await eventsApi("GET", `/${eventBId}`)).json);
    assert.equal(Number(eventA.totalBudget), 375);
    assert.equal(Number(eventB.totalBudget), 25);
  });

  it("deleting a task with a budget subtracts it from the event's total", async () => {
    const created = await tasksApi("POST", "", {
      name: "Temp task",
      description: "",
      deadline: "2026-08-24T00:00:00.000Z",
      eventId: eventBId,
      budget: 10,
    });
    const taskId = asTask(created.json).taskId;

    let eventB = asEvent((await eventsApi("GET", `/${eventBId}`)).json);
    assert.equal(Number(eventB.totalBudget), 35);

    await tasksApi("DELETE", `/${taskId}`);

    eventB = asEvent((await eventsApi("GET", `/${eventBId}`)).json);
    assert.equal(Number(eventB.totalBudget), 25);
  });

  it("creating an event with taskIds assigns those tasks and rolls up budget", async () => {
    const createdTask = await tasksApi("POST", "", {
      name: "Assigned at event create",
      description: "",
      deadline: "2026-08-27T00:00:00.000Z",
      budget: 40,
    });
    assert.equal(createdTask.status, 201);
    const taskId = asTask(createdTask.json).taskId;
    createdTaskIds.push(taskId);

    const createdEvent = await eventsApi("POST", "", {
      name: "Event with tasks at create",
      description: "",
      date: "2026-09-06T00:00:00.000Z",
      locationId,
      budget: 100,
      taskIds: [taskId],
    });
    assert.equal(createdEvent.status, 201);
    const created = asEvent(createdEvent.json);
    assert.equal(Number(created.totalBudget), 40);

    const task = asTask((await tasksApi("GET", `/${taskId}`)).json);
    assert.equal(task.eventId, created.eventId);

    await eventsApi("DELETE", `/${created.eventId}`);
  });

  it("creating an event with subtasks stores them as assigned tasks", async () => {
    const createdEvent = await eventsApi("POST", "", {
      name: "Event with inline subtasks",
      description: "",
      date: "2026-09-08T00:00:00.000Z",
      locationId,
      budget: 100,
      subtasks: [
        {
          name: "Print programmes",
          deadline: "2026-09-01T00:00:00.000Z",
          budget: 30,
        },
        {
          name: "Brief volunteers",
          deadline: "2026-09-02T00:00:00.000Z",
        },
      ],
    });
    assert.equal(createdEvent.status, 201);
    const created = createdEvent.json as Event & {
      eventId: number;
      totalBudget: string;
      tasks: Array<{ taskId: number; name: string; eventId: number | null }>;
    };
    assert.equal(Number(created.totalBudget), 30);
    assert.equal(created.tasks.length, 2);
    assert.deepEqual(
      created.tasks.map((task) => task.name).sort(),
      ["Brief volunteers", "Print programmes"],
    );
    for (const task of created.tasks) {
      createdTaskIds.push(task.taskId);
      assert.equal(task.eventId, created.eventId);
    }

    const updated = await eventsApi("PATCH", `/${created.eventId}`, {
      subtasks: [
        {
          name: "Set up signage",
          deadline: "2026-09-03T00:00:00.000Z",
        },
      ],
    });
    assert.equal(updated.status, 200);
    const updatedEvent = updated.json as {
      tasks: Array<{ taskId: number; name: string; eventId: number }>;
    };
    const createdNames = updatedEvent.tasks.map((task) => task.name);
    assert.ok(createdNames.includes("Set up signage"));
    assert.ok(createdNames.includes("Print programmes"));
    for (const task of updatedEvent.tasks) {
      if (!createdTaskIds.includes(task.taskId)) {
        createdTaskIds.push(task.taskId);
      }
    }

    await eventsApi("DELETE", `/${created.eventId}`);
  });

  it("updating an event taskIds list assigns and unassigns tasks", async () => {
    const keep = await tasksApi("POST", "", {
      name: "Keep on event",
      description: "",
      deadline: "2026-08-28T00:00:00.000Z",
      budget: 12,
    });
    const drop = await tasksApi("POST", "", {
      name: "Drop from event",
      description: "",
      deadline: "2026-08-28T00:00:00.000Z",
      budget: 8,
    });
    const keepId = asTask(keep.json).taskId;
    const dropId = asTask(drop.json).taskId;
    createdTaskIds.push(keepId, dropId);

    const createdEvent = await eventsApi("POST", "", {
      name: "Event task sync",
      description: "",
      date: "2026-09-07T00:00:00.000Z",
      locationId,
      budget: 100,
      taskIds: [keepId, dropId],
    });
    assert.equal(createdEvent.status, 201);
    const eventId = asEvent(createdEvent.json).eventId;
    assert.equal(Number(asEvent(createdEvent.json).totalBudget), 20);

    const updated = await eventsApi("PATCH", `/${eventId}`, { taskIds: [keepId] });
    assert.equal(updated.status, 200);
    assert.equal(Number(asEvent(updated.json).totalBudget), 12);
    assert.equal(asTask((await tasksApi("GET", `/${keepId}`)).json).eventId, eventId);
    assert.equal(asTask((await tasksApi("GET", `/${dropId}`)).json).eventId, null);

    await eventsApi("DELETE", `/${eventId}`);
  });

  it("rejects a negative budget on create", async () => {
    const { status } = await tasksApi("POST", "", {
      name: "Invalid budget task",
      description: "",
      deadline: "2026-08-25T00:00:00.000Z",
      budget: -5,
    });
    assert.equal(status, 400);
  });

  it("rejects a negative budget on update", async () => {
    const created = await tasksApi("POST", "", {
      name: "Valid budget task",
      description: "",
      deadline: "2026-08-25T00:00:00.000Z",
      budget: 5,
    });
    const taskId = asTask(created.json).taskId;
    createdTaskIds.push(taskId);

    const { status } = await tasksApi("PATCH", `/${taskId}`, { budget: -1 });
    assert.equal(status, 400);
  });

  it("deleting an event unlinks its tasks instead of deleting them", async () => {
    const location = await prisma.location.create({ data: { name: `Budget Test Location Temp ${Date.now()}` } });
    const tempEvent = await prisma.event.create({
      data: {
        name: "Temp Event To Delete",
        description: "",
        date: new Date("2026-09-05T00:00:00.000Z"),
        budget: 100,
        location: { connect: { locationId: location.locationId } },
        bookable: { create: { bookableType: "Event" } },
      },
    });

    const created = await tasksApi("POST", "", {
      name: "Survives event deletion",
      description: "",
      deadline: "2026-08-26T00:00:00.000Z",
      eventId: tempEvent.eventId,
      budget: 1,
    });
    const taskId = asTask(created.json).taskId;
    createdTaskIds.push(taskId);

    await eventsApi("DELETE", `/${tempEvent.eventId}`);

    const { status, json } = await tasksApi("GET", `/${taskId}`);
    assert.equal(status, 200);
    assert.equal(asTask(json).eventId, null);

    await prisma.location.deleteMany({ where: { locationId: location.locationId } });
  });

  it("stores an event budget separately from the allocated task total", async () => {
    const createdEvent = await eventsApi("POST", "", {
      name: "Capped event",
      description: "",
      date: "2026-09-12T00:00:00.000Z",
      locationId,
      budget: 100,
    });
    assert.equal(createdEvent.status, 201);
    const eventId = asEvent(createdEvent.json).eventId;
    assert.equal(Number(asEvent(createdEvent.json).budget), 100);
    assert.equal(Number(asEvent(createdEvent.json).totalBudget), 0);

    const created = await tasksApi("POST", "", {
      name: "Within the cap",
      description: "",
      deadline: "2026-09-01T00:00:00.000Z",
      eventId,
      budget: 40,
    });
    assert.equal(created.status, 201);
    createdTaskIds.push(asTask(created.json).taskId);

    const event = asEvent((await eventsApi("GET", `/${eventId}`)).json);
    assert.equal(Number(event.budget), 100);
    assert.equal(Number(event.totalBudget), 40);

    await eventsApi("DELETE", `/${eventId}`);
  });

  it("rejects a task whose budget would exceed the event budget", async () => {
    const createdEvent = await eventsApi("POST", "", {
      name: "Tight budget event",
      description: "",
      date: "2026-09-13T00:00:00.000Z",
      locationId,
      budget: 50,
    });
    assert.equal(createdEvent.status, 201);
    const eventId = asEvent(createdEvent.json).eventId;

    const over = await tasksApi("POST", "", {
      name: "Too expensive",
      description: "",
      deadline: "2026-09-01T00:00:00.000Z",
      eventId,
      budget: 75,
    });
    assert.equal(over.status, 400);
    assert.match(String(over.json.error), /exceed the event budget/);

    const event = asEvent((await eventsApi("GET", `/${eventId}`)).json);
    assert.equal(Number(event.totalBudget), 0);

    await eventsApi("DELETE", `/${eventId}`);
  });

  it("rejects raising a task budget or lowering the event budget past the cap", async () => {
    const createdEvent = await eventsApi("POST", "", {
      name: "Adjustable cap",
      description: "",
      date: "2026-09-14T00:00:00.000Z",
      locationId,
      budget: 80,
    });
    const eventId = asEvent(createdEvent.json).eventId;

    const created = await tasksApi("POST", "", {
      name: "Grow later",
      description: "",
      deadline: "2026-09-01T00:00:00.000Z",
      eventId,
      budget: 30,
    });
    assert.equal(created.status, 201);
    const taskId = asTask(created.json).taskId;
    createdTaskIds.push(taskId);

    const raised = await tasksApi("PATCH", `/${taskId}`, { budget: 90 });
    assert.equal(raised.status, 400);

    const still = asEvent((await eventsApi("GET", `/${eventId}`)).json);
    assert.equal(Number(still.totalBudget), 30);
    assert.equal(Number(still.budget), 80);

    const lowered = await eventsApi("PATCH", `/${eventId}`, { budget: 20 });
    assert.equal(lowered.status, 400);
    assert.equal(Number(asEvent((await eventsApi("GET", `/${eventId}`)).json).budget), 80);

    await eventsApi("DELETE", `/${eventId}`);
  });

  it("rejects assigning existing tasks whose budgets exceed the event budget", async () => {
    const createdTask = await tasksApi("POST", "", {
      name: "Already priced",
      description: "",
      deadline: "2026-09-01T00:00:00.000Z",
      budget: 60,
    });
    assert.equal(createdTask.status, 201);
    const taskId = asTask(createdTask.json).taskId;
    createdTaskIds.push(taskId);

    const createdEvent = await eventsApi("POST", "", {
      name: "Cannot absorb priced task",
      description: "",
      date: "2026-09-15T00:00:00.000Z",
      locationId,
      budget: 25,
      taskIds: [taskId],
    });
    assert.equal(createdEvent.status, 400);
    assert.equal(asTask((await tasksApi("GET", `/${taskId}`)).json).eventId, null);
  });

  it("treats a blank event budget as zero", async () => {
    const createdEvent = await eventsApi("POST", "", {
      name: "Blank budget event",
      description: "",
      date: "2026-09-17T00:00:00.000Z",
      locationId,
      budget: "",
    });
    assert.equal(createdEvent.status, 201);
    const eventId = asEvent(createdEvent.json).eventId;
    assert.equal(Number(asEvent(createdEvent.json).budget), 0);

    const over = await tasksApi("POST", "", {
      name: "Needs a budget",
      description: "",
      deadline: "2026-09-01T00:00:00.000Z",
      eventId,
      budget: 1,
    });
    assert.equal(over.status, 400);
    assert.match(String(over.json.error), /exceed the event budget/);

    await eventsApi("DELETE", `/${eventId}`);
  });

  it("rejects a negative event budget", async () => {
    const { status } = await eventsApi("POST", "", {
      name: "Negative budget event",
      description: "",
      date: "2026-09-16T00:00:00.000Z",
      locationId,
      budget: -10,
    });
    assert.equal(status, 400);
  });
});
