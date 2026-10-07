/**
 * Clash flagging over the API — RTM Req 7, end to end.
 *
 * Complements `tests/conflicts.test.ts`, which covers the interval maths in
 * isolation: this checks the parts only the database and the routes can answer.
 * Above all that a clash is *flagged and saved* — a 201 carrying `conflicts` —
 * rather than rejected, and that a malformed range is the one thing that is
 * rejected.
 *
 * Needs the app running and a reachable database:
 *   npm run dev
 *   npx tsx --test tests/conflict-api.test.ts
 *
 * `middleware.ts` guards every `/api/` route, so the suite signs in first and
 * sends the session cookie on every request — an unauthenticated run would
 * otherwise see nothing but 401s.
 */

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.ts";

const ORIGIN = process.env.API_ORIGIN ?? "http://localhost:3000";

/** Set in `before` by signing in; sent on every subsequent request. */
let cookie = "";

type Conflict = {
  kind: "venue" | "resource" | "schedule";
  severity: "error" | "warning";
  message: string;
  window: { start: string; end: string };
  left: Record<string, unknown>;
  right: Record<string, unknown>;
};

type CreatedEvent = { eventId: number; bookableId: number; conflicts: Conflict[] };
type CreatedAllocation = { allocationId: number; conflicts: Conflict[] };

async function api(path: string, method = "GET", body?: unknown) {
  const headers: Record<string, string> = {};
  if (body) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;

  const response = await fetch(`${ORIGIN}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => null);
  return { status: response.status, json };
}

/** Creates a throwaway member and exchanges it for a session cookie. */
async function signIn(email: string, password: string) {
  const response = await fetch(`${ORIGIN}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(`Could not sign in as ${email} (${response.status})`);
  }
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) throw new Error("Login returned no session cookie");
  return setCookie.split(";")[0];
}

/** 2 Nov 2026 at `hour`, UTC — far enough out not to collide with real data. */
function at(hour: number): string {
  return new Date(Date.UTC(2026, 10, 2, hour)).toISOString();
}

/**
 * Narrows to the clashes involving one particular event.
 *
 * A `schedule` warning is deliberately global — any two events running at once
 * raise one, whatever their venue — so fixtures from other tests in this file
 * legitimately warn about each other. Asserting on the pair under test keeps
 * these checks precise and independent of the order they run in.
 */
function involving(conflicts: readonly Conflict[], eventId: number): Conflict[] {
  return conflicts.filter((conflict) =>
    [conflict.left, conflict.right].some((ref) => ref.eventId === eventId),
  );
}

describe("Conflict flagging API", () => {
  const stamp = Date.now();
  let venueA: number;
  let venueB: number;
  /** Used only by the "moved clear" test, which needs a venue nothing else touches. */
  let venueC: number;
  let resourceId: number;
  let resourceTypeId: number;
  let testerId: number;
  const createdEventIds: number[] = [];
  const createdAllocationIds: number[] = [];
  const createdTaskIds: number[] = [];

  async function createEvent(
    name: string,
    locationId: number,
    startHour: number,
    endHour: number,
    extra: Record<string, unknown> = {},
  ) {
    const { status, json } = await api("/api/events", "POST", {
      name,
      description: "",
      date: at(startHour),
      endDate: at(endHour),
      locationId,
      ...extra,
    });
    const event = json as CreatedEvent;
    if (event?.eventId) createdEventIds.push(event.eventId);
    return { status, event };
  }

  before(async () => {
    const health = await fetch(`${ORIGIN}/api/auth/login`, { method: "POST" }).catch(() => null);
    if (!health) {
      throw new Error(`API not reachable at ${ORIGIN}. Start the app with: npm run dev`);
    }

    const password = `clash-tester-${stamp}`;
    const tester = await prisma.member.create({
      data: {
        name: "Clash Tester",
        role: "Admin",
        email: `clash-tester-${stamp}@mdn.test`,
        password: await bcrypt.hash(password, 10),
      },
    });
    testerId = tester.memberId;
    cookie = await signIn(tester.email, password);

    const a = await prisma.location.create({ data: { name: `Clash Venue A ${stamp}` } });
    const b = await prisma.location.create({ data: { name: `Clash Venue B ${stamp}` } });
    const c = await prisma.location.create({ data: { name: `Clash Venue C ${stamp}` } });
    venueA = a.locationId;
    venueB = b.locationId;
    venueC = c.locationId;

    const type = await prisma.resourceType.create({
      data: { name: `Clash Type ${stamp}` },
    });
    resourceTypeId = type.typeId;
    const resource = await prisma.resource.create({
      data: { name: `Clash Projector ${stamp}`, resourceType: type.typeId },
    });
    resourceId = resource.resourceId;
  });

  after(async () => {
    for (const allocationId of createdAllocationIds) {
      await api(`/api/resource-allocations/${allocationId}`, "DELETE").catch(() => undefined);
    }
    for (const eventId of createdEventIds) {
      await api(`/api/events/${eventId}`, "DELETE").catch(() => undefined);
    }
    for (const taskId of createdTaskIds) {
      await api(`/api/tasks/${taskId}`, "DELETE").catch(() => undefined);
    }
    await prisma.resource.deleteMany({ where: { resourceId } });
    await prisma.resourceType.deleteMany({ where: { typeId: resourceTypeId } });
    await prisma.location.deleteMany({
      where: { locationId: { in: [venueA, venueB, venueC] } },
    });
    await prisma.member.deleteMany({ where: { memberId: testerId } });
    await prisma.$disconnect();
  });

  it("creates a clash-free event with an empty conflicts array", async () => {
    const { status, event } = await createEvent("Clash: solo", venueA, 1, 2);
    assert.equal(status, 201);
    assert.deepEqual(event.conflicts, []);
  });

  it("flags a venue clash but still saves the event", async () => {
    await createEvent("Clash: venue first", venueA, 9, 12);
    const { status, event } = await createEvent("Clash: venue second", venueA, 11, 13);

    // The whole point of Req 7: flagged, not blocked.
    assert.equal(status, 201);
    assert.ok(event.eventId);

    const venue = event.conflicts.find((c) => c.kind === "venue");
    assert.ok(venue, `expected a venue conflict, got ${JSON.stringify(event.conflicts)}`);
    assert.equal(venue.severity, "error");
    assert.match(venue.message, /Clash: venue first/);
  });

  it("does not flag events that merely sit back-to-back in one venue", async () => {
    const { event: earlier } = await createEvent("Clash: earlier slot", venueB, 14, 15);
    const { status, event } = await createEvent("Clash: later slot", venueB, 15, 16);

    assert.equal(status, 201);
    assert.deepEqual(involving(event.conflicts, earlier.eventId), []);
  });

  it("flags overlapping events at different venues as a schedule warning", async () => {
    const { event: here } = await createEvent("Clash: here", venueA, 20, 22);
    const { status, event } = await createEvent("Clash: elsewhere", venueB, 20, 22);

    assert.equal(status, 201);
    const pair = involving(event.conflicts, here.eventId);
    assert.deepEqual(
      pair.map((c) => c.kind),
      ["schedule"],
    );
    assert.equal(pair[0].severity, "warning");
  });

  it("lists both sides of a clash from GET /api/conflicts", async () => {
    const { event: first } = await createEvent("Clash: listed A", venueA, 3, 5);
    const { event: second } = await createEvent("Clash: listed B", venueA, 4, 6);

    const { status, json } = await api("/api/conflicts");
    assert.equal(status, 200);

    const pair = (json as Conflict[]).filter(
      (c) =>
        c.kind === "venue" &&
        [c.left, c.right].some((ref) => ref.eventId === first.eventId) &&
        [c.left, c.right].some((ref) => ref.eventId === second.eventId),
    );
    assert.equal(pair.length, 1);
  });

  it("stops clashing once an event is moved clear, and names real ids", async () => {
    // Its own venue and hours, so no other test in this file can occupy them.
    const { event: blocker } = await createEvent("Clash: blocker", venueC, 6, 8);
    const { event: mover } = await createEvent("Clash: mover", venueC, 7, 9);

    const venue = mover.conflicts.find((c) => c.kind === "venue");
    assert.ok(venue, `expected a venue conflict, got ${JSON.stringify(mover.conflicts)}`);
    // The response must point at rows the caller can actually fetch, never at an
    // internal placeholder id.
    const ids = [venue.left, venue.right].map((ref) => ref.eventId).sort();
    assert.deepEqual(ids, [blocker.eventId, mover.eventId].sort());

    const moved = await api(`/api/events/${mover.eventId}`, "PATCH", {
      date: at(8),
      endDate: at(10),
    });
    assert.equal(moved.status, 200);
    const after = (moved.json as CreatedEvent).conflicts;
    // Exactly back-to-back with the blocker now, so that pair must be clear.
    assert.deepEqual(involving(after, blocker.eventId), []);
    // And an event must never be reported as clashing with itself.
    assert.deepEqual(involving(after, mover.eventId!), after);
    assert.ok(
      after.every((c) => {
        const ids = [c.left, c.right].map((ref) => ref.eventId);
        return ids[0] !== ids[1];
      }),
    );
  });

  it("rejects an event whose end is not after its start", async () => {
    const { status, json } = await api("/api/events", "POST", {
      name: "Clash: inverted",
      description: "",
      date: at(12),
      endDate: at(10),
      locationId: venueA,
    });
    assert.equal(status, 400);
    // Caught by lib/validation.ts and keyed to the field the form shows it under.
    assert.match(String(json.fieldErrors?.endDate), /end must be after the start/);
  });

  it("rejects an event with no end at all", async () => {
    const { status } = await api("/api/events", "POST", {
      name: "Clash: endless",
      description: "",
      date: at(12),
      locationId: venueA,
    });
    assert.equal(status, 400);
  });

  it("flags a resource booked twice over the same window", async () => {
    const { event: host } = await createEvent("Clash: booking host", venueB, 1, 3);

    const first = await api("/api/resource-allocations", "POST", {
      resourceId,
      bookableId: host.bookableId,
      startTime: at(1),
      endTime: at(3),
    });
    assert.equal(first.status, 201);
    createdAllocationIds.push((first.json as CreatedAllocation).allocationId);

    const { event: other } = await createEvent("Clash: booking rival", venueA, 2, 4);
    const second = await api("/api/resource-allocations", "POST", {
      resourceId,
      bookableId: other.bookableId,
      startTime: at(2),
      endTime: at(4),
    });
    const allocation = second.json as CreatedAllocation;
    createdAllocationIds.push(allocation.allocationId);

    assert.equal(second.status, 201);
    const resourceClash = allocation.conflicts.find((c) => c.kind === "resource");
    assert.ok(
      resourceClash,
      `expected a resource conflict, got ${JSON.stringify(allocation.conflicts)}`,
    );
    assert.equal(resourceClash.severity, "error");
  });

  it("rejects a booking whose end is not after its start", async () => {
    const { event: host } = await createEvent("Clash: bad window host", venueB, 5, 7);
    const { status, json } = await api("/api/resource-allocations", "POST", {
      resourceId,
      bookableId: host.bookableId,
      startTime: at(7),
      endTime: at(5),
    });
    assert.equal(status, 400);
    assert.match(String(json.fieldErrors?.endTime), /end must be after the start/);
  });

  it("previews a clash without saving anything", async () => {
    const { event: existing } = await createEvent("Clash: preview target", venueA, 15, 18);

    const { status, json } = await api("/api/conflicts/preview", "POST", {
      kind: "event",
      date: at(16),
      endDate: at(17),
      locationId: venueA,
    });

    assert.equal(status, 200);
    const venue = (json as Conflict[]).find((c) => c.kind === "venue");
    assert.ok(venue, `expected a venue conflict, got ${JSON.stringify(json)}`);
    assert.match(venue.message, /Clash: preview target/);
    assert.equal(
      [venue.left, venue.right].filter((ref) => ref.eventId === existing.eventId).length,
      1,
    );

    // Nothing was written. Checked by looking for a row at the previewed slot
    // rather than by counting every event: `tsx --test` runs the test files
    // concurrently, so a global count races with the other suites.
    const written = await prisma.event.count({
      where: { eventLocationId: venueA, date: new Date(at(16)) },
    });
    assert.equal(written, 0);
  });

  it("moves a task's bookings with its deadline so they do not drift", async () => {
    const created = await api("/api/tasks", "POST", {
      name: "Clash: shifting task",
      description: "",
      deadline: at(1),
    });
    const task = created.json as { taskId: number; bookableId: number };
    createdTaskIds.push(task.taskId);

    const booking = await api("/api/resource-allocations", "POST", {
      resourceId,
      bookableId: task.bookableId,
      startTime: at(1),
      endTime: at(3),
    });
    const allocationId = (booking.json as CreatedAllocation).allocationId;
    createdAllocationIds.push(allocationId);

    // Deadline forward by five hours; the booking should follow by the same
    // amount and keep its two-hour length, not be reset to a default window.
    const moved = await api(`/api/tasks/${task.taskId}`, "PATCH", { deadline: at(6) });
    assert.equal(moved.status, 200);

    const after = await api(`/api/resource-allocations/${allocationId}`);
    const row = after.json as { startTime: string; endTime: string };
    assert.equal(row.startTime, at(6));
    assert.equal(row.endTime, at(8));
  });

  it("treats an incomplete candidate as nothing to check, not an error", async () => {
    const { status, json } = await api("/api/conflicts/preview", "POST", {
      kind: "event",
      locationId: venueA,
    });
    assert.equal(status, 200);
    assert.deepEqual(json, []);
  });
});
