/**
 * Clash detection — RTM Req 7: "the system shall automatically flag when events
 * are overlapping/clashing with dates, venues, or assigned resources."
 *
 * Three kinds, deliberately separated by how much they should alarm anyone:
 *
 *   venue     two events in one location at once      — error
 *   resource  one resource booked twice at once       — error
 *   schedule  two events at once, nothing shared      — warning
 *
 * Nothing here blocks a write. The requirement says *flag*, and a committee that
 * genuinely means to run two things at once should not have to fight the app;
 * the routes attach these to a 200/201 and the UI shows them.
 *
 * This module is pure — no Prisma, no React — so the interval maths, which is
 * where this actually goes wrong, is testable without a database or a running
 * server, and the client can import it without dragging Prisma into the bundle.
 * `lib/timeline.ts` is kept free of React for the same reason. The database side
 * lives in `lib/conflictQueries.ts`.
 */

/** Milliseconds since the epoch, half-open: `[start, end)`. */
export type Interval = { start: number; end: number };

export type ConflictKind = "venue" | "resource" | "schedule";

/** `venue`/`resource` are real double-bookings; `schedule` is only a heads-up. */
export type Severity = "error" | "warning";

export type ConflictRef =
  | { type: "event"; eventId: number; name: string }
  | {
      type: "allocation";
      allocationId: number;
      resourceId: number;
      resourceName: string;
      bookableId: number;
      bookableLabel: string;
    };

export type Conflict = {
  kind: ConflictKind;
  severity: Severity;
  /** Ready to render, so every surface says the same thing. */
  message: string;
  /** The overlapping slice only, as ISO strings — not either full span. */
  window: { start: string; end: string };
  /** Whichever starts first. */
  left: ConflictRef;
  right: ConflictRef;
};

export type EventSpan = Interval & {
  eventId: number;
  name: string;
  locationId: number;
  locationName: string;
};

export type AllocationSpan = Interval & {
  allocationId: number;
  resourceId: number;
  resourceName: string;
  bookableId: number;
  /** e.g. "Event: Launch Night". */
  bookableLabel: string;
};

/**
 * Half-open overlap: a booking that ends exactly when the next begins does NOT
 * clash. Back-to-back is the normal way to reuse a room, and treating it as a
 * collision would flag half the calendar.
 *
 * Same convention as `lib/timeline.ts` (`b.start < furthestEnd`); the two must
 * not drift, or the timeline and the badges will disagree about the same data.
 */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** The shared slice of two intervals, or null when they do not overlap. */
export function intersection(a: Interval, b: Interval): Interval | null {
  if (!overlaps(a, b)) return null;
  return { start: Math.max(a.start, b.start), end: Math.min(a.end, b.end) };
}

/**
 * An interval counts only if it moves forward in time.
 *
 * Inverted and zero-length ranges are dropped rather than clamped: they are a
 * data bug (the write paths reject them with a 400), and silently treating one
 * as an instant would invent clashes that nobody can act on.
 *
 * Exported because the query layer needs the identical test on candidates, and
 * two copies of this rule would be two chances for them to drift.
 */
export function isForwardInterval(i: Interval): boolean {
  return Number.isFinite(i.start) && Number.isFinite(i.end) && i.end > i.start;
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

/** Order-independent key for "this pair has already been reported". */
function pairKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/**
 * Every overlapping pair within one group, each pair once, earlier start first.
 *
 * Compares against all spans still open rather than only the previous one: a
 * long booking can overlap several later ones, and comparing neighbours alone
 * would find the first and miss the rest.
 */
function overlappingPairs<T extends Interval>(spans: readonly T[]): Array<[T, T]> {
  const sorted = [...spans].sort((a, b) => a.start - b.start || a.end - b.end);
  const pairs: Array<[T, T]> = [];
  const open: T[] = [];

  for (const span of sorted) {
    // Anything that has already ended cannot clash with this span or any later
    // one, so it leaves the window for good.
    for (let i = open.length - 1; i >= 0; i -= 1) {
      if (open[i].end <= span.start) open.splice(i, 1);
    }
    // Sorted by start, so everything still open starts no later than this span
    // and ends after it begins — i.e. overlaps it.
    for (const other of open) pairs.push([other, span]);
    open.push(span);
  }

  return pairs;
}

function groupBy<T>(items: readonly T[], key: (item: T) => number): Map<number, T[]> {
  const groups = new Map<number, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = groups.get(k);
    if (bucket) bucket.push(item);
    else groups.set(k, [item]);
  }
  return groups;
}

function eventRef(span: EventSpan): ConflictRef {
  return { type: "event", eventId: span.eventId, name: span.name };
}

function allocationRef(span: AllocationSpan): ConflictRef {
  return {
    type: "allocation",
    allocationId: span.allocationId,
    resourceId: span.resourceId,
    resourceName: span.resourceName,
    bookableId: span.bookableId,
    bookableLabel: span.bookableLabel,
  };
}

/**
 * Venue and schedule clashes among a set of events.
 *
 * A venue clash is by definition also a time overlap, so a pair reported as a
 * venue clash is not reported again as a schedule warning — one problem, one
 * flag.
 */
export function findEventConflicts(events: readonly EventSpan[]): Conflict[] {
  const valid = events.filter(isForwardInterval);
  const conflicts: Conflict[] = [];
  const venuePairs = new Set<string>();

  for (const sameVenue of groupBy(valid, (e) => e.locationId).values()) {
    for (const [a, b] of overlappingPairs(sameVenue)) {
      const window = intersection(a, b);
      if (!window) continue;
      venuePairs.add(pairKey(a.eventId, b.eventId));
      conflicts.push({
        kind: "venue",
        severity: "error",
        message: `"${a.name}" and "${b.name}" both use ${a.locationName} at the same time`,
        window: { start: iso(window.start), end: iso(window.end) },
        left: eventRef(a),
        right: eventRef(b),
      });
    }
  }

  for (const [a, b] of overlappingPairs(valid)) {
    if (venuePairs.has(pairKey(a.eventId, b.eventId))) continue;
    const window = intersection(a, b);
    if (!window) continue;
    conflicts.push({
      kind: "schedule",
      severity: "warning",
      message: `"${a.name}" and "${b.name}" run at the same time`,
      window: { start: iso(window.start), end: iso(window.end) },
      left: eventRef(a),
      right: eventRef(b),
    });
  }

  return conflicts;
}

/** Resource clashes: one resource booked for overlapping windows. */
export function findAllocationConflicts(
  allocations: readonly AllocationSpan[],
): Conflict[] {
  const valid = allocations.filter(isForwardInterval);
  const conflicts: Conflict[] = [];

  for (const sameResource of groupBy(valid, (a) => a.resourceId).values()) {
    for (const [a, b] of overlappingPairs(sameResource)) {
      const window = intersection(a, b);
      if (!window) continue;
      conflicts.push({
        kind: "resource",
        severity: "error",
        // One bookable holding the same resource twice is a duplicate booking
        // rather than two parties contending for it — still worth flagging, but
        // naming the same event on both sides of "both ... and ..." reads as a bug.
        message:
          a.bookableId === b.bookableId
            ? `${a.resourceName} is booked twice for ${a.bookableLabel} over the same window`
            : `${a.resourceName} is booked for both ${a.bookableLabel} and ${b.bookableLabel} at once`,
        window: { start: iso(window.start), end: iso(window.end) },
        left: allocationRef(a),
        right: allocationRef(b),
      });
    }
  }

  return conflicts;
}

/** Does this conflict involve the given event? */
export function involvesEvent(conflict: Conflict, eventId: number): boolean {
  return [conflict.left, conflict.right].some(
    (ref) => ref.type === "event" && ref.eventId === eventId,
  );
}

/** Does this conflict involve the given allocation? */
export function involvesAllocation(conflict: Conflict, allocationId: number): boolean {
  return [conflict.left, conflict.right].some(
    (ref) => ref.type === "allocation" && ref.allocationId === allocationId,
  );
}

/**
 * Index conflicts by every event they touch, for a list that badges each row.
 * An event with no clashes is simply absent.
 */
export function conflictsByEvent(conflicts: readonly Conflict[]): Map<number, Conflict[]> {
  const index = new Map<number, Conflict[]>();
  for (const conflict of conflicts) {
    for (const ref of [conflict.left, conflict.right]) {
      if (ref.type !== "event") continue;
      const bucket = index.get(ref.eventId);
      if (bucket) bucket.push(conflict);
      else index.set(ref.eventId, [conflict]);
    }
  }
  return index;
}

/** Index conflicts by every allocation they touch. */
export function conflictsByAllocation(
  conflicts: readonly Conflict[],
): Map<number, Conflict[]> {
  const index = new Map<number, Conflict[]>();
  for (const conflict of conflicts) {
    for (const ref of [conflict.left, conflict.right]) {
      if (ref.type !== "allocation") continue;
      const bucket = index.get(ref.allocationId);
      if (bucket) bucket.push(conflict);
      else index.set(ref.allocationId, [conflict]);
    }
  }
  return index;
}
