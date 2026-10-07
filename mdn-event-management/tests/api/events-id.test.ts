import { describe, expect, it } from "vitest";
import { DELETE, GET, PATCH } from "@/app/api/events/[eventId]/route";
import { prismaError, prismaMock } from "../helpers/prisma";
import { jsonRequest, params, read } from "../helpers/request";

const ctx = params({ eventId: "3" });

const event = {
  eventId: 3,
  name: "Launch night",
  description: "",
  date: new Date("2026-09-06T00:00:00.000Z"),
  endDate: new Date("2026-09-06T02:00:00.000Z"),
  bookableId: 30,
  totalBudget: 0,
  tasks: [],
};

/** `updateEvent` reads the event twice: once up front, once to return it. */
function existingEvent(after: object = event) {
  prismaMock.event.findUniqueOrThrow
    .mockResolvedValueOnce({ date: event.date, endDate: event.endDate, bookableId: 30 } as never)
    .mockResolvedValueOnce(after as never);
}

describe("GET /api/events/[eventId]", () => {
  it("returns a single event", async () => {
    prismaMock.event.findUnique.mockResolvedValue(event as never);

    const { status, json } = await read(await GET(jsonRequest("GET"), ctx));

    expect(status).toBe(200);
    expect(json.eventId).toBe(3);
    expect(prismaMock.event.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { eventId: 3 } }),
    );
  });

  it("returns 404 when the lookup throws", async () => {
    prismaMock.event.findUnique.mockRejectedValue(new Error("boom"));

    const { status } = await read(await GET(jsonRequest("GET"), ctx));

    expect(status).toBe(404);
  });

  // Current behaviour: a missing event is answered with 200 and a `null` body.
  it.todo("returns 404 for an event id that does not exist");
});

describe("PATCH /api/events/[eventId]", () => {
  it("updates fields and reschedules existing allocations when the span moves", async () => {
    existingEvent({ ...event, name: "Renamed" });

    const { status, json } = await read(
      await PATCH(
        jsonRequest("PATCH", {
          name: "Renamed",
          date: "2026-10-01T10:00:00.000Z",
          endDate: "2026-10-01T12:00:00.000Z",
          locationId: "2",
        }),
        ctx,
      ),
    );

    expect(status).toBe(200);
    expect(json.name).toBe("Renamed");
    expect(prismaMock.event.update.mock.calls[0][0]).toMatchObject({
      where: { eventId: 3 },
      data: {
        name: "Renamed",
        date: new Date("2026-10-01T10:00:00.000Z"),
        location: { connect: { locationId: 2 } },
      },
    });
    expect(prismaMock.resourceAllocation.updateMany).toHaveBeenCalledWith({
      where: { bookableId: 30 },
      data: {
        startTime: new Date("2026-10-01T10:00:00.000Z"),
        endTime: new Date("2026-10-01T12:00:00.000Z"),
      },
    });
  });

  it("replaces allocations when resourceIds is given", async () => {
    existingEvent();

    await PATCH(jsonRequest("PATCH", { resourceIds: [9, 9, 10] }), ctx);

    expect(prismaMock.resourceAllocation.deleteMany).toHaveBeenCalledWith({
      where: { bookableId: 30 },
    });
    expect(prismaMock.resourceAllocation.createMany).toHaveBeenCalledWith({
      data: [9, 10].map((resourceId) => ({
        resourceId,
        bookableId: 30,
        startTime: event.date,
        endTime: event.endDate,
      })),
    });
    expect(prismaMock.resourceAllocation.updateMany).not.toHaveBeenCalled();
  });

  it("replaces event managers", async () => {
    existingEvent();

    await PATCH(jsonRequest("PATCH", { managerIds: [4, "5"] }), ctx);

    expect(prismaMock.event.update.mock.calls[0][0].data.eventManagers).toEqual({
      deleteMany: {},
      create: [{ memberId: 4 }, { memberId: 5 }],
    });
  });

  it("re-syncs taskIds and recalculates the event total", async () => {
    existingEvent({ ...event, totalBudget: 12 });
    prismaMock.task.findMany.mockResolvedValue([{ taskId: 10, eventId: 3 }] as never);
    prismaMock.task.aggregate.mockResolvedValue({ _sum: { budget: 12 } } as never);

    const { status, json } = await read(await PATCH(jsonRequest("PATCH", { taskIds: [10] }), ctx));

    expect(status).toBe(200);
    expect(Number(json.totalBudget)).toBe(12);
    expect(prismaMock.event.update).toHaveBeenCalledWith({
      where: { eventId: 3 },
      data: { tasks: { set: [{ taskId: 10 }] } },
    });
    expect(prismaMock.event.update).toHaveBeenCalledWith({
      where: { eventId: 3 },
      data: { totalBudget: 12 },
    });
  });

  it("appends new subtasks", async () => {
    existingEvent();
    prismaMock.task.aggregate.mockResolvedValue({ _sum: { budget: null } } as never);

    await PATCH(
      jsonRequest("PATCH", {
        subtasks: [{ name: "Set up signage", deadline: "2026-09-03T00:00:00.000Z" }],
      }),
      ctx,
    );

    expect(prismaMock.task.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.task.create.mock.calls[0][0].data).toMatchObject({
      name: "Set up signage",
      event: { connect: { eventId: 3 } },
    });
    // Existing tasks are left alone: no `tasks.set` update.
    expect(prismaMock.task.findMany).not.toHaveBeenCalled();
  });

  it("rejects invalid subtasks with 400", async () => {
    const { status } = await read(await PATCH(jsonRequest("PATCH", { subtasks: "nope" }), ctx));

    expect(status).toBe(400);
  });

  it("returns 404 for an unknown event", async () => {
    prismaMock.event.findUniqueOrThrow.mockRejectedValue(prismaError("P2025"));

    const { status } = await read(await PATCH(jsonRequest("PATCH", { name: "x" }), ctx));

    expect(status).toBe(404);
  });

  it("returns 500 for other failures", async () => {
    prismaMock.event.findUniqueOrThrow.mockRejectedValue(new Error("db down"));

    const { status } = await read(await PATCH(jsonRequest("PATCH", { name: "x" }), ctx));

    expect(status).toBe(500);
  });
});

describe("DELETE /api/events/[eventId]", () => {
  it("unlinks tasks instead of deleting them, then removes the event and bookable", async () => {
    prismaMock.event.findUniqueOrThrow.mockResolvedValue({ bookableId: 30 } as never);

    const { status, json } = await read(await DELETE(jsonRequest("DELETE"), ctx));

    expect(status).toBe(200);
    expect(json.message).toBe("Event deleted successfully");
    expect(prismaMock.eventManager.deleteMany).toHaveBeenCalledWith({ where: { eventId: 3 } });
    expect(prismaMock.resourceAllocation.deleteMany).toHaveBeenCalledWith({
      where: { bookableId: 30 },
    });
    expect(prismaMock.task.updateMany).toHaveBeenCalledWith({
      where: { eventId: 3 },
      data: { eventId: null },
    });
    expect(prismaMock.task.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.event.delete).toHaveBeenCalledWith({ where: { eventId: 3 } });
    expect(prismaMock.bookable.delete).toHaveBeenCalledWith({ where: { bookableId: 30 } });
  });

  it("returns 404 for an unknown event", async () => {
    prismaMock.event.findUniqueOrThrow.mockRejectedValue(prismaError("P2025"));

    const { status } = await read(await DELETE(jsonRequest("DELETE"), ctx));

    expect(status).toBe(404);
  });

  it("returns 500 for other failures", async () => {
    prismaMock.event.findUniqueOrThrow.mockRejectedValue(new Error("db down"));

    const { status } = await read(await DELETE(jsonRequest("DELETE"), ctx));

    expect(status).toBe(500);
  });
});
