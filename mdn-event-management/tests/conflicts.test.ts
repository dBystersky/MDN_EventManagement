/**
 * Clash detection — the interval maths (RTM Req 7).
 *
 * Unlike `task-api.test.ts` and `task-budget.test.ts`, these need no database
 * and no running server: `lib/conflicts.ts` is pure on purpose, so the rules
 * that are easy to get subtly wrong — the half-open boundary, one long span
 * overlapping several short ones, a venue clash not double-reporting as a
 * schedule warning — are checked directly.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  conflictsByAllocation,
  conflictsByEvent,
  findAllocationConflicts,
  findEventConflicts,
  intersection,
  involvesAllocation,
  involvesEvent,
  overlaps,
  type AllocationSpan,
  type EventSpan,
} from "../lib/conflicts.ts";

/** Hour `h` on 27 Sep 2026, UTC, so the fixtures read as a clock. */
function at(h: number): number {
  return Date.UTC(2026, 8, 27, h);
}

function ev(
  eventId: number,
  name: string,
  locationId: number,
  startHour: number,
  endHour: number,
): EventSpan {
  return {
    eventId,
    name,
    locationId,
    locationName: `Venue ${locationId}`,
    start: at(startHour),
    end: at(endHour),
  };
}

function alloc(
  allocationId: number,
  resourceId: number,
  bookableId: number,
  startHour: number,
  endHour: number,
): AllocationSpan {
  return {
    allocationId,
    resourceId,
    resourceName: `Resource ${resourceId}`,
    bookableId,
    bookableLabel: `Event: Booking ${bookableId}`,
    start: at(startHour),
    end: at(endHour),
  };
}

describe("overlaps / intersection", () => {
  it("treats intervals as half-open, so back-to-back does not clash", () => {
    const a = { start: at(9), end: at(11) };
    const b = { start: at(11), end: at(13) };
    assert.equal(overlaps(a, b), false);
    assert.equal(overlaps(b, a), false);
    assert.equal(intersection(a, b), null);
  });

  it("flags partial overlap, containment, and identical ranges", () => {
    const base = { start: at(9), end: at(17) };
    assert.equal(overlaps(base, { start: at(16), end: at(20) }), true);
    assert.equal(overlaps(base, { start: at(11), end: at(12) }), true);
    assert.equal(overlaps(base, { start: at(9), end: at(17) }), true);
  });

  it("returns only the shared slice, not either full span", () => {
    const window = intersection({ start: at(9), end: at(17) }, { start: at(16), end: at(20) });
    assert.deepEqual(window, { start: at(16), end: at(17) });
  });

  it("is symmetric", () => {
    const a = { start: at(9), end: at(12) };
    const b = { start: at(10), end: at(14) };
    assert.equal(overlaps(a, b), overlaps(b, a));
    assert.deepEqual(intersection(a, b), intersection(b, a));
  });
});

describe("findEventConflicts", () => {
  it("finds nothing when one event ends exactly as the next begins", () => {
    const conflicts = findEventConflicts([ev(1, "Workshop", 1, 9, 11), ev(2, "AGM", 1, 11, 13)]);
    assert.deepEqual(conflicts, []);
  });

  it("flags two events sharing a venue as a venue error", () => {
    const conflicts = findEventConflicts([ev(1, "Workshop", 1, 9, 12), ev(2, "AGM", 1, 11, 13)]);

    assert.equal(conflicts.length, 1);
    const [conflict] = conflicts;
    assert.equal(conflict.kind, "venue");
    assert.equal(conflict.severity, "error");
    assert.match(conflict.message, /Venue 1/);
    assert.deepEqual(conflict.window, {
      start: new Date(at(11)).toISOString(),
      end: new Date(at(12)).toISOString(),
    });
  });

  it("does not also report a venue clash as a schedule warning", () => {
    const conflicts = findEventConflicts([ev(1, "Workshop", 1, 9, 12), ev(2, "AGM", 1, 11, 13)]);
    assert.deepEqual(
      conflicts.map((c) => c.kind),
      ["venue"],
    );
  });

  it("flags overlapping events at different venues as a schedule warning only", () => {
    const conflicts = findEventConflicts([ev(1, "Workshop", 1, 9, 12), ev(2, "AGM", 2, 11, 13)]);

    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].kind, "schedule");
    assert.equal(conflicts[0].severity, "warning");
  });

  it("names the earlier-starting event as `left`", () => {
    const conflicts = findEventConflicts([ev(2, "AGM", 1, 11, 13), ev(1, "Workshop", 1, 9, 12)]);

    const [{ left, right }] = conflicts;
    assert.equal(left.type === "event" && left.eventId, 1);
    assert.equal(right.type === "event" && right.eventId, 2);
  });

  it("reports every pair when one long event swallows several short ones", () => {
    const conflicts = findEventConflicts([
      ev(1, "All day", 1, 9, 18),
      ev(2, "Morning", 1, 10, 11),
      ev(3, "Noon", 1, 12, 13),
      ev(4, "Evening", 1, 16, 17),
    ]);

    // 1↔2, 1↔3, 1↔4 — the short ones do not touch each other.
    assert.equal(conflicts.length, 3);
    assert.ok(conflicts.every((c) => c.kind === "venue"));
    assert.deepEqual(
      conflicts.map((c) => (c.right.type === "event" ? c.right.eventId : 0)).sort((a, b) => a - b),
      [2, 3, 4],
    );
  });

  it("skips inverted and zero-length spans rather than inventing a clash", () => {
    assert.deepEqual(
      findEventConflicts([
        ev(1, "Backwards", 1, 14, 9),
        ev(2, "Instant", 1, 11, 11),
        ev(3, "Real", 1, 9, 17),
      ]),
      [],
    );
  });

  it("leaves a single event alone", () => {
    assert.deepEqual(findEventConflicts([ev(1, "Only", 1, 9, 17)]), []);
    assert.deepEqual(findEventConflicts([]), []);
  });
});

describe("findAllocationConflicts", () => {
  it("flags one resource booked for two overlapping windows", () => {
    const conflicts = findAllocationConflicts([alloc(1, 7, 100, 9, 12), alloc(2, 7, 200, 11, 13)]);

    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].kind, "resource");
    assert.equal(conflicts[0].severity, "error");
    assert.match(conflicts[0].message, /Resource 7/);
    assert.match(conflicts[0].message, /Booking 100/);
    assert.match(conflicts[0].message, /Booking 200/);
  });

  it("ignores overlaps between different resources", () => {
    assert.deepEqual(
      findAllocationConflicts([alloc(1, 7, 100, 9, 12), alloc(2, 8, 200, 9, 12)]),
      [],
    );
  });

  it("allows a resource to be handed straight from one booking to the next", () => {
    assert.deepEqual(
      findAllocationConflicts([alloc(1, 7, 100, 9, 11), alloc(2, 7, 200, 11, 13)]),
      [],
    );
  });

  it("reports every pair when one long booking swallows several short ones", () => {
    const conflicts = findAllocationConflicts([
      alloc(1, 7, 100, 9, 18),
      alloc(2, 7, 200, 10, 11),
      alloc(3, 7, 300, 12, 13),
      alloc(4, 7, 400, 16, 17),
    ]);
    assert.equal(conflicts.length, 3);
  });

  it("flags a resource shared by an event and an unrelated task", () => {
    const eventBooking = alloc(1, 7, 100, 9, 17);
    const taskBooking: AllocationSpan = {
      ...alloc(2, 7, 900, 10, 12),
      bookableLabel: "Task: Set up the stage",
    };

    const conflicts = findAllocationConflicts([eventBooking, taskBooking]);
    assert.equal(conflicts.length, 1);
    assert.match(conflicts[0].message, /Task: Set up the stage/);
  });

  it("words a duplicate booking as such rather than naming one side twice", () => {
    const conflicts = findAllocationConflicts([alloc(1, 7, 100, 9, 12), alloc(2, 7, 100, 10, 13)]);

    assert.equal(conflicts.length, 1);
    assert.match(conflicts[0].message, /booked twice for Event: Booking 100/);
    assert.doesNotMatch(conflicts[0].message, /both/);
  });

  it("skips inverted spans", () => {
    assert.deepEqual(
      findAllocationConflicts([alloc(1, 7, 100, 14, 9), alloc(2, 7, 200, 9, 17)]),
      [],
    );
  });
});

describe("indexing helpers", () => {
  const conflicts = findEventConflicts([
    ev(1, "All day", 1, 9, 18),
    ev(2, "Morning", 1, 10, 11),
    ev(3, "Noon", 2, 12, 13),
  ]);

  it("indexes a conflict under both of its events", () => {
    const index = conflictsByEvent(conflicts);
    assert.equal(index.get(1)?.length, 2); // clashes with 2 (venue) and 3 (schedule)
    assert.equal(index.get(2)?.length, 1);
    assert.equal(index.get(3)?.length, 1);
  });

  it("omits events with no clashes entirely", () => {
    const index = conflictsByEvent(findEventConflicts([ev(9, "Alone", 3, 9, 10)]));
    assert.equal(index.get(9), undefined);
    assert.equal(index.size, 0);
  });

  it("indexes allocations the same way", () => {
    const index = conflictsByAllocation(
      findAllocationConflicts([alloc(1, 7, 100, 9, 18), alloc(2, 7, 200, 10, 11)]),
    );
    assert.equal(index.get(1)?.length, 1);
    assert.equal(index.get(2)?.length, 1);
  });

  it("answers whether a conflict touches a given row", () => {
    const [conflict] = conflicts;
    assert.equal(involvesEvent(conflict, 1), true);
    assert.equal(involvesEvent(conflict, 99), false);
    assert.equal(involvesAllocation(conflict, 1), false);
  });
});
