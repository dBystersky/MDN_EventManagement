import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/tasks/route";
import { prismaError, prismaMock } from "../helpers/prisma";
import { jsonRequest, read } from "../helpers/request";

const task = {
  taskId: 7,
  name: "Order PCB",
  description: "Rev A boards",
  deadline: new Date("2026-09-15T17:00:00.000Z"),
  bookableId: 70,
  eventId: null,
  budget: null,
  bookable: { bookableId: 70, bookableType: "Task" },
  taskManagers: [],
};

describe("GET /api/tasks", () => {
  it("lists all tasks ordered by deadline", async () => {
    prismaMock.task.findMany.mockResolvedValue([task] as never);

    const { status, json } = await read(await GET(jsonRequest("GET")));

    expect(status).toBe(200);
    expect(json).toHaveLength(1);
    expect(json[0].name).toBe("Order PCB");
    expect(prismaMock.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined, orderBy: { deadline: "asc" } }),
    );
  });

  it("filters by ?eventId", async () => {
    prismaMock.task.findMany.mockResolvedValue([] as never);

    await GET(jsonRequest("GET", undefined, "http://localhost/api/tasks?eventId=3"));

    expect(prismaMock.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventId: 3 } }),
    );
  });

  it("returns 500 when the query fails", async () => {
    prismaMock.task.findMany.mockRejectedValue(new Error("db down"));

    const { status, json } = await read(await GET(jsonRequest("GET")));

    expect(status).toBe(500);
    expect(json.error).toContain("db down");
  });
});

describe("POST /api/tasks", () => {
  it("creates a task with a linked Task bookable", async () => {
    prismaMock.task.create.mockResolvedValue(task as never);

    const { status, json } = await read(
      await POST(
        jsonRequest("POST", {
          name: "Order PCB",
          description: "Rev A boards",
          deadline: "2026-09-15T17:00:00.000Z",
        }),
      ),
    );

    expect(status).toBe(201);
    expect(json.taskId).toBe(7);
    const { data } = prismaMock.task.create.mock.calls[0][0];
    expect(data).toMatchObject({
      name: "Order PCB",
      description: "Rev A boards",
      deadline: new Date("2026-09-15T17:00:00.000Z"),
      bookable: { create: { bookableType: "Task" } },
      taskManagers: undefined,
      event: undefined,
    });
    // No event, so no budget rollup.
    expect(prismaMock.task.aggregate).not.toHaveBeenCalled();
  });

  it("creates manager assignments", async () => {
    prismaMock.task.create.mockResolvedValue(task as never);

    await POST(
      jsonRequest("POST", {
        name: "Assigned task",
        description: "",
        deadline: "2026-10-01T12:00:00.000Z",
        managerIds: [4, 5],
      }),
    );

    expect(prismaMock.task.create.mock.calls[0][0].data.taskManagers).toEqual({
      create: [{ memberId: 4 }, { memberId: 5 }],
    });
  });

  it("links the task to an event and recalculates that event's total budget", async () => {
    prismaMock.task.create.mockResolvedValue({ ...task, eventId: 3, budget: 150.5 } as never);
    prismaMock.task.aggregate.mockResolvedValue({ _sum: { budget: 150.5 } } as never);

    const { status } = await read(
      await POST(
        jsonRequest("POST", {
          name: "Book venue",
          description: "",
          deadline: "2026-08-20T00:00:00.000Z",
          eventId: 3,
          budget: 150.5,
        }),
      ),
    );

    expect(status).toBe(201);
    expect(prismaMock.task.create.mock.calls[0][0].data).toMatchObject({
      budget: 150.5,
      event: { connect: { eventId: 3 } },
    });
    expect(prismaMock.task.aggregate).toHaveBeenCalledWith({
      where: { eventId: 3 },
      _sum: { budget: true },
    });
    expect(prismaMock.event.update).toHaveBeenCalledWith({
      where: { eventId: 3 },
      data: { totalBudget: 150.5 },
    });
  });

  it("rejects a negative budget with 400 without touching the database", async () => {
    const { status, json } = await read(
      await POST(
        jsonRequest("POST", {
          name: "Invalid budget task",
          description: "",
          deadline: "2026-08-25T00:00:00.000Z",
          budget: -5,
        }),
      ),
    );

    expect(status).toBe(400);
    expect(json.error).toBe("budget must not be negative");
    expect(prismaMock.task.create).not.toHaveBeenCalled();
  });

  it("returns 500 with the Prisma error code when the insert fails", async () => {
    prismaMock.task.create.mockRejectedValue(prismaError("P2003"));

    const { status, json } = await read(
      await POST(
        jsonRequest("POST", { name: "x", description: "", deadline: "2026-01-01", eventId: 999 }),
      ),
    );

    expect(status).toBe(500);
    expect(json).toMatchObject({ error: "Failed to create task", code: "P2003" });
  });
});
