import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { prisma } from "../lib/prisma.ts";

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
    headers: body ? { "Content-Type": "application/json" } : undefined,
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
});
