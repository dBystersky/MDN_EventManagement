/**
 * Input validation through the routes (RTM Req 9).
 *
 * `tests/validation.test.ts` covers the rules. These check that every write
 * route applies them: a 400 whose `fieldErrors` names the field the form shows
 * the message under, before anything reaches the database. They also check
 * that a PATCH which leaves fields out still goes through.
 */

import { describe, expect, it } from "vitest";
import { POST as CREATE_EVENT } from "@/app/api/events/route";
import { PATCH as UPDATE_EVENT } from "@/app/api/events/[eventId]/route";
import { POST as CREATE_LOCATION } from "@/app/api/locations/route";
import { PATCH as UPDATE_LOCATION } from "@/app/api/locations/[locationId]/route";
import { POST as CREATE_TYPE } from "@/app/api/resource-types/route";
import { POST as CREATE_RESOURCE } from "@/app/api/resources/route";
import { POST as CREATE_ALLOCATION } from "@/app/api/resource-allocations/route";
import { POST as CREATE_TASK } from "@/app/api/tasks/route";
import { POST as CREATE_MEMBER } from "@/app/api/admin/members/route";
import { asUser } from "../helpers/auth";
import { prismaMock } from "../helpers/prisma";
import { jsonRequest, params, read } from "../helpers/request";

type Rejection = { error: string; fieldErrors: Record<string, string> };

/** A 400 naming `fields`, still carrying the one-line `error` older callers read. */
async function expectRejected(response: Response, fields: string[]) {
  const { status, json } = (await read(response)) as { status: number; json: Rejection };
  expect(status).toBe(400);
  expect(Object.keys(json.fieldErrors).sort()).toEqual([...fields].sort());
  expect(json.error).toBe(Object.values(json.fieldErrors)[0]);
}

const event = {
  name: "Launch night",
  description: "",
  date: "2026-09-06T00:00:00.000Z",
  endDate: "2026-09-06T02:00:00.000Z",
  locationId: 1,
};

describe("events", () => {
  it("names every missing field at once instead of failing with a 500", async () => {
    await expectRejected(
      await CREATE_EVENT(jsonRequest("POST", { description: "", date: event.date })),
      ["name", "endDate", "locationId"],
    );
    expect(prismaMock.event.create).not.toHaveBeenCalled();
  });

  it("treats a whitespace-only name as missing", async () => {
    await expectRejected(await CREATE_EVENT(jsonRequest("POST", { ...event, name: "  " })), [
      "name",
    ]);
  });

  it("lets a PATCH leave untouched fields out", async () => {
    prismaMock.event.findUniqueOrThrow
      .mockResolvedValueOnce({
        date: new Date(event.date),
        endDate: new Date(event.endDate),
        bookableId: 30,
      } as never)
      .mockResolvedValueOnce({ eventId: 3, name: "Renamed" } as never);

    const { status } = await read(
      await UPDATE_EVENT(jsonRequest("PATCH", { name: "Renamed" }), params({ eventId: "3" })),
    );

    expect(status).toBe(200);
  });

  it("still rejects a PATCH that blanks a field", async () => {
    await expectRejected(
      await UPDATE_EVENT(jsonRequest("PATCH", { name: "" }), params({ eventId: "3" })),
      ["name"],
    );
    expect(prismaMock.event.update).not.toHaveBeenCalled();
  });
});

describe("the named things", () => {
  it("rejects an empty location name instead of storing it", async () => {
    await expectRejected(await CREATE_LOCATION(jsonRequest("POST", { name: "" })), ["name"]);
    await expectRejected(
      await UPDATE_LOCATION(jsonRequest("PATCH", { name: " " }), params({ locationId: "3" })),
      ["name"],
    );
    expect(prismaMock.location.create).not.toHaveBeenCalled();
    expect(prismaMock.location.update).not.toHaveBeenCalled();
  });

  it("rejects an empty resource type name", async () => {
    await expectRejected(await CREATE_TYPE(jsonRequest("POST", { name: "" })), ["name"]);
    expect(prismaMock.resourceType.create).not.toHaveBeenCalled();
  });

  it("rejects a resource with no type", async () => {
    await expectRejected(await CREATE_RESOURCE(jsonRequest("POST", { name: "Orphan" })), [
      "resourceTypeId",
    ]);
    expect(prismaMock.resource.create).not.toHaveBeenCalled();
  });
});

describe("bookings and tasks", () => {
  it("rejects an allocation with no resource", async () => {
    await expectRejected(
      await CREATE_ALLOCATION(
        jsonRequest("POST", { bookableId: 1, startTime: event.date, endTime: event.endDate }),
      ),
      ["resourceId"],
    );
    expect(prismaMock.resourceAllocation.create).not.toHaveBeenCalled();
  });

  it("rejects a budget the Decimal(10, 2) column cannot hold exactly", async () => {
    await expectRejected(
      await CREATE_TASK(
        jsonRequest("POST", { name: "Print", deadline: event.date, budget: 1.234 }),
      ),
      ["budget"],
    );
    expect(prismaMock.task.create).not.toHaveBeenCalled();
  });
});

describe("members", () => {
  const member = { name: "Grace", email: "grace@mdn.test", password: "hunter22", role: "Manager" };

  it("rejects a malformed email or a short password", async () => {
    asUser("Admin");

    await expectRejected(await CREATE_MEMBER(jsonRequest("POST", { ...member, email: "grace" })), [
      "email",
    ]);
    await expectRejected(
      await CREATE_MEMBER(jsonRequest("POST", { ...member, password: "short" })),
      ["password"],
    );
    expect(prismaMock.member.create).not.toHaveBeenCalled();
  });

  it("reports a taken email against the email field", async () => {
    asUser("Admin");
    prismaMock.member.findUnique.mockResolvedValue({ memberId: 2 } as never);

    await expectRejected(await CREATE_MEMBER(jsonRequest("POST", member)), ["email"]);
    expect(prismaMock.member.create).not.toHaveBeenCalled();
  });
});
