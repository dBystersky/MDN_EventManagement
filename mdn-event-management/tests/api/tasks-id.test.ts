import { describe, expect, it } from "vitest";
import { DELETE, GET, PATCH } from "@/app/api/tasks/[taskId]/route";
import { prismaError, prismaMock } from "../helpers/prisma";
import { jsonRequest, params, read } from "../helpers/request";

const ctx = params({ taskId: "7" });

const task = {
  taskId: 7,
  name: "Fetch me",
  description: "",
  deadline: new Date("2026-11-01T00:00:00.000Z"),
  bookableId: 70,
  eventId: null as number | null,
  budget: null,
  taskManagers: [],
};

/** Every `event.update` that set a total budget, as `[eventId, total]` pairs. */
function budgetRecalculations() {
  return prismaMock.event.update.mock.calls
    .map(([args]) => args)
    .filter((args) => args.data && "totalBudget" in args.data)
    .map((args) => [args.where.eventId, args.data.totalBudget]);
}

describe("GET /api/tasks/[taskId]", () => {
  it("returns a single task", async () => {
    prismaMock.task.findUnique.mockResolvedValue(task as never);

    const { status, json } = await read(await GET(jsonRequest("GET"), ctx));

    expect(status).toBe(200);
    expect(json).toMatchObject({ taskId: 7, name: "Fetch me" });
    expect(prismaMock.task.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { taskId: 7 } }),
    );
  });

  it("returns 404 when the lookup throws", async () => {
    prismaMock.task.findUnique.mockRejectedValue(new Error("boom"));

    const { status } = await read(await GET(jsonRequest("GET"), ctx));

    expect(status).toBe(404);
  });

  // Current behaviour: `findUnique` resolves to null, so the handler answers
  // 200 with a `null` body instead of 404.
  it.todo("returns 404 for a task id that does not exist");
});

describe("PATCH /api/tasks/[taskId]", () => {
  it("updates name, description and deadline", async () => {
    prismaMock.task.findUniqueOrThrow.mockResolvedValue({ eventId: null } as never);
    prismaMock.task.update.mockResolvedValue({ ...task, name: "After" } as never);

    const { status, json } = await read(
      await PATCH(
        jsonRequest("PATCH", {
          name: "After",
          description: "new",
          deadline: "2026-12-01T00:00:00.000Z",
        }),
        ctx,
      ),
    );

    expect(status).toBe(200);
    expect(json.name).toBe("After");
    const call = prismaMock.task.update.mock.calls[0][0];
    expect(call.where).toEqual({ taskId: 7 });
    expect(call.data).toMatchObject({
      name: "After",
      description: "new",
      deadline: new Date("2026-12-01T00:00:00.000Z"),
      event: undefined,
    });
    expect(call.data).not.toHaveProperty("taskManagers");
  });

  it("replaces manager assignments, dropping non-numeric ids", async () => {
    prismaMock.task.findUniqueOrThrow.mockResolvedValue({ eventId: null } as never);
    prismaMock.task.update.mockResolvedValue(task as never);

    await PATCH(jsonRequest("PATCH", { managerIds: [4, "5", "nope"] }), ctx);

    expect(prismaMock.task.update.mock.calls[0][0].data.taskManagers).toEqual({
      deleteMany: {},
      create: [{ memberId: 4 }, { memberId: 5 }],
    });
  });

  it("clears manager assignments with an empty list", async () => {
    prismaMock.task.findUniqueOrThrow.mockResolvedValue({ eventId: null } as never);
    prismaMock.task.update.mockResolvedValue(task as never);

    await PATCH(jsonRequest("PATCH", { managerIds: [] }), ctx);

    expect(prismaMock.task.update.mock.calls[0][0].data.taskManagers).toEqual({
      deleteMany: {},
      create: [],
    });
  });

  it("recalculates the event total when the budget changes", async () => {
    prismaMock.task.findUniqueOrThrow.mockResolvedValue({ eventId: 1 } as never);
    prismaMock.task.update.mockResolvedValue({ ...task, eventId: 1, budget: 175 } as never);
    prismaMock.task.aggregate.mockResolvedValue({ _sum: { budget: 375 } } as never);

    const { status } = await read(await PATCH(jsonRequest("PATCH", { budget: 175 }), ctx));

    expect(status).toBe(200);
    expect(budgetRecalculations()).toEqual([[1, 375]]);
  });

  it("recalculates both totals when a task moves to another event", async () => {
    prismaMock.task.findUniqueOrThrow.mockResolvedValue({ eventId: 1 } as never);
    prismaMock.task.update.mockResolvedValue({ ...task, eventId: 2 } as never);
    prismaMock.task.aggregate
      .mockResolvedValueOnce({ _sum: { budget: 25 } } as never)
      .mockResolvedValueOnce({ _sum: { budget: 375 } } as never);

    await PATCH(jsonRequest("PATCH", { eventId: 2 }), ctx);

    expect(prismaMock.task.update.mock.calls[0][0].data.event).toEqual({
      connect: { eventId: 2 },
    });
    expect(budgetRecalculations()).toEqual([
      [2, 25],
      [1, 375],
    ]);
  });

  it("unlinks the task from its event with eventId: null", async () => {
    prismaMock.task.findUniqueOrThrow.mockResolvedValue({ eventId: 1 } as never);
    prismaMock.task.update.mockResolvedValue({ ...task, eventId: null } as never);
    prismaMock.task.aggregate.mockResolvedValue({ _sum: { budget: null } } as never);

    await PATCH(jsonRequest("PATCH", { eventId: null }), ctx);

    expect(prismaMock.task.update.mock.calls[0][0].data.event).toEqual({ disconnect: true });
    // An event with no budgeted tasks left falls back to 0.
    expect(budgetRecalculations()).toEqual([[1, 0]]);
  });

  it("rejects a negative budget with 400", async () => {
    const { status } = await read(await PATCH(jsonRequest("PATCH", { budget: -1 }), ctx));

    expect(status).toBe(400);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown task", async () => {
    prismaMock.task.findUniqueOrThrow.mockRejectedValue(prismaError("P2025"));

    const { status } = await read(await PATCH(jsonRequest("PATCH", { name: "Nope" }), ctx));

    expect(status).toBe(404);
  });

  it("returns 500 for other failures", async () => {
    prismaMock.task.findUniqueOrThrow.mockRejectedValue(new Error("db down"));

    const { status } = await read(await PATCH(jsonRequest("PATCH", { name: "x" }), ctx));

    expect(status).toBe(500);
  });
});

describe("DELETE /api/tasks/[taskId]", () => {
  it("removes managers, allocations, the task and its bookable", async () => {
    prismaMock.task.findUniqueOrThrow.mockResolvedValue({ bookableId: 70, eventId: null } as never);

    const { status, json } = await read(await DELETE(jsonRequest("DELETE"), ctx));

    expect(status).toBe(200);
    expect(json.message).toBe("Task deleted successfully");
    expect(prismaMock.taskManager.deleteMany).toHaveBeenCalledWith({ where: { taskId: 7 } });
    expect(prismaMock.resourceAllocation.deleteMany).toHaveBeenCalledWith({
      where: { bookableId: 70 },
    });
    expect(prismaMock.task.delete).toHaveBeenCalledWith({ where: { taskId: 7 } });
    expect(prismaMock.bookable.delete).toHaveBeenCalledWith({ where: { bookableId: 70 } });
    expect(prismaMock.task.aggregate).not.toHaveBeenCalled();
  });

  it("subtracts the task's budget from its event's total", async () => {
    prismaMock.task.findUniqueOrThrow.mockResolvedValue({ bookableId: 70, eventId: 2 } as never);
    prismaMock.task.aggregate.mockResolvedValue({ _sum: { budget: 25 } } as never);

    await DELETE(jsonRequest("DELETE"), ctx);

    expect(budgetRecalculations()).toEqual([[2, 25]]);
  });

  it("returns 404 for an unknown task", async () => {
    prismaMock.task.findUniqueOrThrow.mockRejectedValue(prismaError("P2025"));

    const { status } = await read(await DELETE(jsonRequest("DELETE"), ctx));

    expect(status).toBe(404);
    expect(prismaMock.task.delete).not.toHaveBeenCalled();
  });
});
