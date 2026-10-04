/**
 * Input validation over the API — RTM Req 9, end to end.
 *
 * Complements `tests/validation.test.ts`, which covers the rules in isolation:
 * this checks that every write route actually applies them, answering 400 with
 * a `fieldErrors` map keyed by the field the form shows each message under —
 * and that a valid write, or a PATCH that leaves fields alone, still succeeds.
 *
 * Needs the app running and a reachable database:
 *   npm run dev
 *   npx tsx --test tests/validation-api.test.ts
 */

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { prisma } from "../lib/prisma.ts";
import {
  ORIGIN,
  apiClient,
  assertApiReachable,
  createTestSession,
  type TestSession,
} from "./auth-helper.ts";

/** 15 Mar 2027 at `hour`, UTC — a date no other suite uses, so no clash noise. */
function at(hour: number): string {
  return new Date(Date.UTC(2027, 2, 15, hour)).toISOString();
}

type Rejection = { error?: string; fieldErrors?: Record<string, string> };

describe("Validation API", () => {
  const stamp = Date.now();
  let session: TestSession;
  let api: ReturnType<typeof apiClient>;
  let locationId: number;
  let eventId: number | undefined;
  const createdMemberEmails: string[] = [];

  /** Asserts a 400 that names exactly `field`, among possibly others. */
  function assertRejected(
    result: { status: number; json: unknown },
    field: string,
  ) {
    assert.equal(result.status, 400, JSON.stringify(result.json));
    const json = result.json as Rejection;
    assert.ok(json.fieldErrors?.[field], `expected fieldErrors.${field}, got ${JSON.stringify(json)}`);
    assert.ok(json.error, "the one-line summary is still there for older callers");
  }

  before(async () => {
    await assertApiReachable();
    session = await createTestSession("validation");
    api = apiClient(session, `${ORIGIN}/api`);
    const location = await prisma.location.create({
      data: { name: `Validation Venue ${stamp}` },
    });
    locationId = location.locationId;
  });

  after(async () => {
    if (eventId) await api("DELETE", `/events/${eventId}`).catch(() => undefined);
    await prisma.location.deleteMany({ where: { locationId } });
    await prisma.member.deleteMany({ where: { email: { in: createdMemberEmails } } });
    await session.cleanup();
    await prisma.$disconnect();
  });

  const validEvent = () => ({
    name: `Validation event ${stamp}`,
    description: "",
    date: at(10),
    endDate: at(12),
    locationId,
  });

  it("creates a valid event", async () => {
    const { status, json } = await api("POST", "/events", validEvent());
    assert.equal(status, 201, JSON.stringify(json));
    eventId = (json as { eventId: number }).eventId;
  });

  it("rejects an event with no name", async () => {
    assertRejected(await api("POST", "/events", { ...validEvent(), name: "  " }), "name");
  });

  it("rejects an event with no location instead of failing with a 500", async () => {
    const { locationId: _omit, ...body } = validEvent();
    void _omit;
    assertRejected(await api("POST", "/events", body), "locationId");
  });

  it("lets a PATCH leave untouched fields out", async () => {
    assert.ok(eventId, "depends on the create test");
    const { status } = await api("PATCH", `/events/${eventId}`, {
      name: `Validation event renamed ${stamp}`,
    });
    assert.equal(status, 200);
  });

  it("still rejects a PATCH that blanks a field", async () => {
    assert.ok(eventId, "depends on the create test");
    assertRejected(await api("PATCH", `/events/${eventId}`, { name: "" }), "name");
  });

  it("rejects an empty location name instead of storing it", async () => {
    assertRejected(await api("POST", "/locations", { name: "" }), "name");
    assertRejected(await api("PATCH", `/locations/${locationId}`, { name: " " }), "name");
  });

  it("rejects negative and over-precise task budgets", async () => {
    const task = { name: "Validation task", description: "", deadline: at(9) };
    assertRejected(await api("POST", "/tasks", { ...task, budget: -5 }), "budget");
    assertRejected(await api("POST", "/tasks", { ...task, budget: 1.234 }), "budget");
  });

  it("rejects a resource with no type", async () => {
    assertRejected(await api("POST", "/resources", { name: "Orphan" }), "resourceTypeId");
  });

  it("rejects an allocation with no resource", async () => {
    assertRejected(
      await api("POST", "/resource-allocations", {
        bookableId: 1,
        startTime: at(10),
        endTime: at(11),
      }),
      "resourceId",
    );
  });

  it("rejects a member with a malformed email or short password", async () => {
    const member = { name: "Val Idator", email: `val-${stamp}@mdn.test`, password: "longenough" };
    assertRejected(await api("POST", "/admin/members", { ...member, email: "val" }), "email");
    assertRejected(await api("POST", "/admin/members", { ...member, password: "short" }), "password");
  });

  it("reports a taken email against the email field", async () => {
    const member = { name: "Val Idator", email: `val-dupe-${stamp}@mdn.test`, password: "longenough" };
    createdMemberEmails.push(member.email);
    const first = await api("POST", "/admin/members", member);
    assert.equal(first.status, 201, JSON.stringify(first.json));
    assertRejected(await api("POST", "/admin/members", member), "email");
  });
});
