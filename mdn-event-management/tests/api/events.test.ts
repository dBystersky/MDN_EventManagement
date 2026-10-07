import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/events/route";
import { prismaError, prismaMock } from "../helpers/prisma";
import { jsonRequest, read } from "../helpers/request";

const event = {
  eventId: 3,
  name: "Launch night",
  description: "",
  date: new Date("2026-09-06T00:00:00.000Z"),
  endDate: new Date("2026-09-06T02:00:00.000Z"),
  locationId: 1,
  bookableId: 30,
  totalBudget: 0,
  tasks: [],
};

const body = {
  name: "Launch night",
  description: "",
  date: "2026-09-06T00:00:00.000Z",
  endDate: "2026-09-06T02:00:00.000Z",
  locationId: "1",
};

describe("GET /api/events", () => {
  it("lists events ordered by date", async () => {
    prismaMock.event.findMany.mockResolvedValue([event] as never);

    const { status, json } = await read(await GET());

    expect(status).toBe(200);
    expect(json[0].eventId).toBe(3);
    expect(prismaMock.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { date: "asc" } }),
    );
  });

  it("returns 500 when the query fails", async () => {
    prismaMock.event.findMany.mockRejectedValue(new Error("db down"));

    const { status } = await read(await GET());

    expect(status).toBe(500);
  });
});

describe("POST /api/events", () => {
  it("creates an event with its bookable, managers and resource allocations", async () => {
    prismaMock.event.create.mockResolvedValue(event as never);

    const { status, json } = await read(
      await POST(jsonRequest("POST", { ...body, managerIds: ["4"], resourceIds: [9, 9, 10] })),
    );

    expect(status).toBe(201);
    expect(json.eventId).toBe(3);
    const { data } = prismaMock.event.create.mock.calls[0][0];
    expect(data).toMatchObject({
      name: "Launch night",
      date: new Date("2026-09-06T00:00:00.000Z"),
      location: { connect: { locationId: 1 } },
      eventManagers: { create: [{ memberId: 4 }] },
    });
    // Duplicate resource ids collapse; each allocation spans the event itself.
    expect(data.bookable).toEqual({
      create: {
        bookableType: "Event",
        resourceAllocations: {
          create: [9, 10].map((resourceId) => ({
            resourceId,
            startTime: new Date("2026-09-06T00:00:00.000Z"),
            endTime: new Date("2026-09-06T02:00:00.000Z"),
          })),
        },
      },
    });
    // Nothing to sync, so the created row is returned without a re-read.
    expect(prismaMock.event.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("assigns existing tasks and rolls their budget into the new event", async () => {
    prismaMock.event.create.mockResolvedValue(event as never);
    // Task 11 currently belongs to event 8, so event 8's total changes too.
    prismaMock.task.findMany.mockResolvedValue([
      { taskId: 10, eventId: null },
      { taskId: 11, eventId: 8 },
    ] as never);
    prismaMock.task.aggregate
      .mockResolvedValueOnce({ _sum: { budget: 40 } } as never)
      .mockResolvedValueOnce({ _sum: { budget: null } } as never);
    prismaMock.event.findUniqueOrThrow.mockResolvedValue({ ...event, totalBudget: 40 } as never);

    const { status, json } = await read(
      await POST(jsonRequest("POST", { ...body, taskIds: [10, "11", 10] })),
    );

    expect(status).toBe(201);
    expect(Number(json.totalBudget)).toBe(40);
    expect(prismaMock.event.update).toHaveBeenCalledWith({
      where: { eventId: 3 },
      data: { tasks: { set: [{ taskId: 10 }, { taskId: 11 }] } },
    });
    expect(prismaMock.event.update).toHaveBeenCalledWith({
      where: { eventId: 3 },
      data: { totalBudget: 40 },
    });
    expect(prismaMock.event.update).toHaveBeenCalledWith({
      where: { eventId: 8 },
      data: { totalBudget: 0 },
    });
  });

  it("rejects an unknown task id with 400", async () => {
    prismaMock.event.create.mockResolvedValue(event as never);
    prismaMock.task.findMany.mockResolvedValue([{ taskId: 10, eventId: null }] as never);

    const { status, json } = await read(
      await POST(jsonRequest("POST", { ...body, taskIds: [10, 99] })),
    );

    expect(status).toBe(400);
    expect(json.error).toContain("One or more tasks were not found");
  });

  it("creates inline subtasks linked to the event and rolls up their budget", async () => {
    prismaMock.event.create.mockResolvedValue(event as never);
    prismaMock.task.aggregate.mockResolvedValue({ _sum: { budget: 30 } } as never);
    prismaMock.event.findUniqueOrThrow.mockResolvedValue({ ...event, totalBudget: 30 } as never);

    const { status } = await read(
      await POST(
        jsonRequest("POST", {
          ...body,
          subtasks: [
            { name: "Print programmes", deadline: "2026-09-01T00:00:00.000Z", budget: 30 },
            { name: "  Brief volunteers  ", deadline: "2026-09-02T00:00:00.000Z", managerIds: [4] },
          ],
        }),
      ),
    );

    expect(status).toBe(201);
    const created = prismaMock.task.create.mock.calls.map(([args]) => args.data);
    expect(created).toHaveLength(2);
    expect(created[0]).toMatchObject({
      name: "Print programmes",
      description: "",
      budget: 30,
      event: { connect: { eventId: 3 } },
      bookable: { create: { bookableType: "Task" } },
    });
    expect(created[1]).toMatchObject({
      name: "Brief volunteers",
      taskManagers: { create: [{ memberId: 4 }] },
    });
    expect(prismaMock.event.update).toHaveBeenCalledWith({
      where: { eventId: 3 },
      data: { totalBudget: 30 },
    });
  });

  it.each([
    ["not an array", { name: "x" }, "subtasks must be an array"],
    ["missing a name", [{ deadline: "2026-09-01" }], "subtasks[0] needs a name"],
    [
      "an invalid deadline",
      [{ name: "x", deadline: "soon" }],
      "subtasks[0] needs a valid deadline",
    ],
    [
      "an invalid budget",
      [{ name: "x", deadline: "2026-09-01", budget: "lots" }],
      "subtasks[0] has an invalid budget",
    ],
  ])("rejects subtasks that are %s with 400", async (_label, subtasks, message) => {
    const { status, json } = await read(await POST(jsonRequest("POST", { ...body, subtasks })));

    expect(status).toBe(400);
    expect(json.error).toBe(message);
    expect(prismaMock.event.create).not.toHaveBeenCalled();
  });

  it("rejects a subtask with a negative budget with 400", async () => {
    const subtasks = [{ name: "x", deadline: "2026-09-01", budget: -1 }];
    const { status } = await read(await POST(jsonRequest("POST", { ...body, subtasks })));

    expect(status).toBe(400);
    expect(prismaMock.event.create).not.toHaveBeenCalled();
  });

  it("returns 500 with the Prisma error code when the insert fails", async () => {
    prismaMock.event.create.mockRejectedValue(prismaError("P2025"));

    const { status, json } = await read(await POST(jsonRequest("POST", body)));

    expect(status).toBe(500);
    expect(json).toMatchObject({ error: "Failed to create event", code: "P2025" });
  });
});
