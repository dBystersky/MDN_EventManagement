/**
 * Clash flagging through the routes (RTM Req 7).
 *
 * `tests/conflicts.test.ts` covers the interval maths. These cover what only
 * the routes decide: a clash is flagged and saved (a 201 with `conflicts`), not
 * rejected, and an inverted range is the one thing that is rejected.
 */

import { describe, expect, it } from "vitest";
import { GET as LIST } from "@/app/api/conflicts/route";
import { POST as PREVIEW } from "@/app/api/conflicts/preview/route";
import { POST as CREATE_EVENT } from "@/app/api/events/route";
import { POST as CREATE_ALLOCATION } from "@/app/api/resource-allocations/route";
import { asUser } from "../helpers/auth";
import { prismaMock } from "../helpers/prisma";
import { jsonRequest, read } from "../helpers/request";

/** 2 Nov 2026 at `hour`, UTC. */
function at(hour: number) {
  return new Date(Date.UTC(2026, 10, 2, hour));
}

/** A row in the shape `eventSpanSelect` asks for. */
function eventRow(eventId: number, name: string, locationId: number, from: number, to: number) {
  return {
    eventId,
    name,
    date: at(from),
    endDate: at(to),
    eventLocationId: locationId,
    location: { name: `Venue ${locationId}` },
  };
}

/** A row in the shape `allocationSpanInclude` asks for. */
function allocationRow(allocationId: number, resourceId: number, from: number, to: number) {
  return {
    allocationId,
    resourceId,
    bookableId: 40 + allocationId,
    startTime: at(from),
    endTime: at(to),
    resource: { name: `Resource ${resourceId}` },
    bookable: { bookableType: "Event", events: { name: "Rival" }, tasks: null },
  };
}

describe("GET /api/conflicts", () => {
  it("flags two events at one venue at once as a venue error", async () => {
    prismaMock.event.findMany.mockResolvedValue([
      eventRow(1, "Gala", 7, 10, 12),
      eventRow(2, "Quiz", 7, 11, 13),
    ] as never);
    prismaMock.resourceAllocation.findMany.mockResolvedValue([] as never);

    const { status, json } = await read(await LIST());

    expect(status).toBe(200);
    expect(json).toHaveLength(1);
    expect(json[0]).toMatchObject({ kind: "venue", severity: "error" });
  });

  it("does not flag back-to-back bookings of the same venue", async () => {
    prismaMock.event.findMany.mockResolvedValue([
      eventRow(1, "Gala", 7, 10, 12),
      eventRow(2, "Quiz", 7, 12, 14),
    ] as never);
    prismaMock.resourceAllocation.findMany.mockResolvedValue([] as never);

    const { json } = await read(await LIST());

    expect(json).toEqual([]);
  });

  it("returns 403 for a guest", async () => {
    asUser("Member", { role: "Guest" });

    const { status } = await read(await LIST());

    expect(status).toBe(403);
    expect(prismaMock.event.findMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/conflicts/preview", () => {
  it("treats an incomplete candidate as nothing to check, not an error", async () => {
    const { status, json } = await read(
      await PREVIEW(jsonRequest("POST", { kind: "event", date: at(10).toISOString() })),
    );

    expect(status).toBe(200);
    expect(json).toEqual([]);
    expect(prismaMock.event.findMany).not.toHaveBeenCalled();
  });

  it("rejects an unknown kind with 400", async () => {
    const { status } = await read(await PREVIEW(jsonRequest("POST", { kind: "party" })));

    expect(status).toBe(400);
  });

  it("previews a venue clash without saving anything", async () => {
    prismaMock.location.findUnique.mockResolvedValue({ name: "Venue 7" } as never);
    prismaMock.event.findMany.mockResolvedValue([eventRow(1, "Gala", 7, 10, 12)] as never);

    const { status, json } = await read(
      await PREVIEW(
        jsonRequest("POST", {
          kind: "event",
          name: "Draft",
          date: at(11).toISOString(),
          endDate: at(13).toISOString(),
          locationId: 7,
        }),
      ),
    );

    expect(status).toBe(200);
    expect(json).toHaveLength(1);
    expect(json[0].kind).toBe("venue");
    expect(prismaMock.event.create).not.toHaveBeenCalled();
  });
});

describe("clashes on write", () => {
  it("creates a clashing event anyway and reports the clash", async () => {
    prismaMock.event.create.mockResolvedValue({
      eventId: 9,
      name: "Quiz",
      bookableId: 90,
      tasks: [],
    } as never);
    // `conflictsForEvent` re-reads the saved event, then previews it.
    prismaMock.event.findUnique.mockResolvedValue({
      name: "Quiz",
      date: at(11),
      endDate: at(13),
      eventLocationId: 7,
      bookable: { resourceAllocations: [] },
    } as never);
    prismaMock.location.findUnique.mockResolvedValue({ name: "Venue 7" } as never);
    prismaMock.event.findMany.mockResolvedValue([eventRow(1, "Gala", 7, 10, 12)] as never);

    const { status, json } = await read(
      await CREATE_EVENT(
        jsonRequest("POST", {
          name: "Quiz",
          description: "",
          date: at(11).toISOString(),
          endDate: at(13).toISOString(),
          locationId: 7,
        }),
      ),
    );

    expect(status).toBe(201);
    expect(json.conflicts).toHaveLength(1);
    expect(json.conflicts[0]).toMatchObject({ kind: "venue", severity: "error" });
  });

  it("creates a double booking anyway and reports the resource clash", async () => {
    prismaMock.resourceAllocation.create.mockResolvedValue({
      allocationId: 5,
      resourceId: 3,
      bookableId: 30,
    } as never);
    prismaMock.resourceAllocation.findUnique.mockResolvedValue({
      resourceId: 3,
      startTime: at(2),
      endTime: at(4),
      bookableId: 30,
    } as never);
    prismaMock.resource.findUnique.mockResolvedValue({ name: "Projector" } as never);
    prismaMock.resourceAllocation.findMany.mockResolvedValue([allocationRow(1, 3, 1, 3)] as never);

    const { status, json } = await read(
      await CREATE_ALLOCATION(
        jsonRequest("POST", {
          resourceId: 3,
          bookableId: 30,
          startTime: at(2).toISOString(),
          endTime: at(4).toISOString(),
        }),
      ),
    );

    expect(status).toBe(201);
    expect(json.conflicts).toHaveLength(1);
    expect(json.conflicts[0]).toMatchObject({ kind: "resource", severity: "error" });
  });

  it("rejects an event whose end is not after its start", async () => {
    const { status, json } = await read(
      await CREATE_EVENT(
        jsonRequest("POST", {
          name: "Inverted",
          date: at(12).toISOString(),
          endDate: at(10).toISOString(),
          locationId: 7,
        }),
      ),
    );

    expect(status).toBe(400);
    expect(json.fieldErrors.endDate).toMatch(/end must be after the start/);
    expect(prismaMock.event.create).not.toHaveBeenCalled();
  });

  it("rejects a booking whose end is not after its start", async () => {
    const { status, json } = await read(
      await CREATE_ALLOCATION(
        jsonRequest("POST", {
          resourceId: 3,
          bookableId: 30,
          startTime: at(7).toISOString(),
          endTime: at(5).toISOString(),
        }),
      ),
    );

    expect(status).toBe(400);
    expect(json.fieldErrors.endTime).toMatch(/end must be after the start/);
    expect(prismaMock.resourceAllocation.create).not.toHaveBeenCalled();
  });
});
