/**
 * The database side of clash detection — RTM Req 7.
 *
 * Kept apart from `lib/conflicts.ts` so the interval maths stays pure and
 * client-importable; everything here only gathers rows, hands them to those
 * functions, and narrows the result.
 *
 * Nothing in here blocks a write. `listAllConflicts` is what the UI reads to
 * badge existing data; the `preview*` functions answer "what would this clash
 * with" for something not yet saved; the `conflictsFor*` functions are what the
 * create and update routes attach to their responses.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
    findAllocationConflicts,
    findEventConflicts,
    involvesAllocation,
    involvesEvent,
    isForwardInterval,
    type AllocationSpan,
    type Conflict,
    type EventSpan,
} from "@/lib/conflicts";

/**
 * A candidate with no row of its own — a create being previewed — is given an id
 * at or below zero, which `autoincrement()` never issues. That lets the preview
 * run the very same pure functions as saved data and then keep only the pairs
 * involving the candidate.
 *
 * When the candidate *does* already exist (an edit, or a write being reported
 * back), it carries its real id instead: the row it is compared against is
 * excluded by that same id, so there is nothing to collide with, and the
 * conflict then names something the caller can actually navigate to.
 */
const CANDIDATE_ID = 0;

const eventSpanSelect = {
  eventId: true,
  name: true,
  date: true,
  endDate: true,
  eventLocationId: true,
  location: { select: { name: true } },
} satisfies Prisma.EventSelect;

type EventSpanRow = Prisma.EventGetPayload<{ select: typeof eventSpanSelect }>;

function toEventSpan(row: EventSpanRow): EventSpan {
  return {
    eventId: row.eventId,
    name: row.name,
    locationId: row.eventLocationId,
    locationName: row.location.name,
    start: row.date.getTime(),
    end: row.endDate.getTime(),
  };
}

const allocationSpanInclude = {
  resource: { select: { name: true } },
  bookable: {
    select: {
      bookableType: true,
      events: { select: { name: true } },
      tasks: { select: { name: true } },
    },
  },
} satisfies Prisma.ResourceAllocationInclude;

type AllocationSpanRow = Prisma.ResourceAllocationGetPayload<{
  include: typeof allocationSpanInclude;
}>;

/** "Event: Launch Night" — the same shape the allocations page already shows. */
function bookableLabel(row: AllocationSpanRow): string {
  const name = row.bookable.events?.name ?? row.bookable.tasks?.name;
  const kind = row.bookable.bookableType;
  return name ? `${kind}: ${name}` : `${kind} #${row.bookableId}`;
}

function toAllocationSpan(row: AllocationSpanRow): AllocationSpan {
  return {
    allocationId: row.allocationId,
    resourceId: row.resourceId,
    resourceName: row.resource.name,
    bookableId: row.bookableId,
    bookableLabel: bookableLabel(row),
    start: row.startTime.getTime(),
    end: row.endTime.getTime(),
  };
}

/**
 * Every clash in the system.
 *
 * Two queries, no per-row round trip: the events list, the allocations table and
 * any future notification job all read this one endpoint and index the result by
 * id, so nothing needs an N+1 of per-event checks.
 */
export async function listAllConflicts(): Promise<Conflict[]> {
  const [events, allocations] = await Promise.all([
    prisma.event.findMany({ select: eventSpanSelect }),
    prisma.resourceAllocation.findMany({ include: allocationSpanInclude }),
  ]);

  return [
    ...findEventConflicts(events.map(toEventSpan)),
    ...findAllocationConflicts(allocations.map(toAllocationSpan)),
  ];
}

export type EventConflictQuery = {
  date: Date;
  endDate: Date;
  locationId: number;
  /** Absent means "do not check resources", which is not the same as "none". */
  resourceIds?: number[];
  /** The event being edited: excluded from its own clash check. */
  excludeEventId?: number;
  /** How the candidate is named in the messages. */
  name?: string;
};

/**
 * What a candidate event would clash with, without saving anything.
 *
 * Drives the live warning in the event form, and — via `conflictsForEvent` —
 * the `conflicts` attached to a create or update response.
 *
 * Queries only the overlapping window rather than scanning the table, using the
 * half-open predicate the `events` index is built for.
 */
export async function previewEventConflicts(
  input: EventConflictQuery,
): Promise<Conflict[]> {
  const candidateName = input.name?.trim() || "This event";
  const start = input.date.getTime();
  const end = input.endDate.getTime();
  if (!isForwardInterval({ start, end })) return [];

  // In parallel: this runs on a debounce while the form is typed into, so one
  // round trip rather than two is worth having.
  const [location, overlapping] = await Promise.all([
    prisma.location.findUnique({
      where: { locationId: input.locationId },
      select: { name: true },
    }),
    prisma.event.findMany({
      where: {
        ...(input.excludeEventId != null
          ? { eventId: { not: input.excludeEventId } }
          : {}),
        date: { lt: input.endDate },
        endDate: { gt: input.date },
      },
      select: eventSpanSelect,
    }),
  ]);

  const candidateId = input.excludeEventId ?? CANDIDATE_ID;
  const candidate: EventSpan = {
    eventId: candidateId,
    name: candidateName,
    locationId: input.locationId,
    locationName: location?.name ?? "this venue",
    start,
    end,
  };

  const conflicts = findEventConflicts([
    candidate,
    ...overlapping.map(toEventSpan),
  ]).filter((conflict) => involvesEvent(conflict, candidateId));

  if (input.resourceIds === undefined) return conflicts;

  return [...conflicts, ...(await candidateResourceConflicts(input, candidateName))];
}

/**
 * Resource clashes for the resources a candidate event would claim.
 *
 * An event's resources are allocated across its whole span, so the candidate
 * bookings are synthesised at that span and compared against what is already
 * booked. On an edit the event's own bookable is excluded, or it would clash
 * with the allocations it is about to replace.
 */
async function candidateResourceConflicts(
  input: EventConflictQuery,
  candidateName: string,
): Promise<Conflict[]> {
  const resourceIds = [...new Set(input.resourceIds ?? [])];
  if (resourceIds.length === 0) return [];

  const own =
    input.excludeEventId != null
      ? await prisma.event.findUnique({
          where: { eventId: input.excludeEventId },
          select: { bookableId: true },
        })
      : null;

  const [resources, booked] = await Promise.all([
    prisma.resource.findMany({
      where: { resourceId: { in: resourceIds } },
      select: { resourceId: true, name: true },
    }),
    prisma.resourceAllocation.findMany({
      where: {
        resourceId: { in: resourceIds },
        startTime: { lt: input.endDate },
        endTime: { gt: input.date },
        ...(own ? { bookableId: { not: own.bookableId } } : {}),
      },
      include: allocationSpanInclude,
    }),
  ]);

  const names = new Map(resources.map((r) => [r.resourceId, r.name]));
  const candidates: AllocationSpan[] = resourceIds.map((resourceId, index) => ({
    // Distinct non-positive ids, so each candidate booking is identifiable.
    allocationId: CANDIDATE_ID - index,
    resourceId,
    resourceName: names.get(resourceId) ?? `Resource #${resourceId}`,
    bookableId: own?.bookableId ?? CANDIDATE_ID,
    bookableLabel: `Event: ${candidateName}`,
    start: input.date.getTime(),
    end: input.endDate.getTime(),
  }));

  return findAllocationConflicts([...candidates, ...booked.map(toAllocationSpan)]).filter(
    (conflict) =>
      candidates.some((candidate) =>
        involvesAllocation(conflict, candidate.allocationId),
      ),
  );
}

export type AllocationConflictQuery = {
  resourceId: number;
  startTime: Date;
  endTime: Date;
  bookableId?: number;
  /** The allocation being edited: excluded from its own clash check. */
  excludeAllocationId?: number;
};

/** What a candidate booking would clash with, without saving anything. */
export async function previewAllocationConflicts(
  input: AllocationConflictQuery,
): Promise<Conflict[]> {
  const start = input.startTime.getTime();
  const end = input.endTime.getTime();
  if (!isForwardInterval({ start, end })) return [];

  const [resource, booked, bookable] = await Promise.all([
    prisma.resource.findUnique({
      where: { resourceId: input.resourceId },
      select: { name: true },
    }),
    prisma.resourceAllocation.findMany({
      where: {
        resourceId: input.resourceId,
        startTime: { lt: input.endTime },
        endTime: { gt: input.startTime },
        ...(input.excludeAllocationId != null
          ? { allocationId: { not: input.excludeAllocationId } }
          : {}),
      },
      include: allocationSpanInclude,
    }),
    input.bookableId != null
      ? prisma.bookable.findUnique({
          where: { bookableId: input.bookableId },
          select: {
            bookableType: true,
            events: { select: { name: true } },
            tasks: { select: { name: true } },
          },
        })
      : null,
  ]);

  const label = bookable
    ? `${bookable.bookableType}: ${bookable.events?.name ?? bookable.tasks?.name ?? `#${input.bookableId}`}`
    : "this booking";

  const candidateId = input.excludeAllocationId ?? CANDIDATE_ID;
  const candidate: AllocationSpan = {
    allocationId: candidateId,
    resourceId: input.resourceId,
    resourceName: resource?.name ?? `Resource #${input.resourceId}`,
    bookableId: input.bookableId ?? CANDIDATE_ID,
    bookableLabel: label,
    start,
    end,
  };

  return findAllocationConflicts([candidate, ...booked.map(toAllocationSpan)]).filter(
    (conflict) => involvesAllocation(conflict, candidateId),
  );
}

/**
 * Clashes for an event that already exists — what the create/update routes hand
 * back so the caller sees the consequence of the write it just made.
 */
export async function conflictsForEvent(eventId: number): Promise<Conflict[]> {
  const event = await prisma.event.findUnique({
    where: { eventId },
    select: {
      name: true,
      date: true,
      endDate: true,
      eventLocationId: true,
      bookable: { select: { resourceAllocations: { select: { allocationId: true } } } },
    },
  });
  if (!event) return [];

  // The event's bookings already exist, so they are checked as themselves
  // rather than synthesised as candidates — that way every conflict names a real
  // allocation the caller can look up. One query per booking, and an event has a
  // handful; this runs on a write, not on a keystroke.
  const [placement, ...perBooking] = await Promise.all([
    previewEventConflicts({
      name: event.name,
      date: event.date,
      endDate: event.endDate,
      locationId: event.eventLocationId,
      excludeEventId: eventId,
    }),
    ...event.bookable.resourceAllocations.map((allocation) =>
      conflictsForAllocation(allocation.allocationId),
    ),
  ]);

  return [...placement, ...dedupe(perBooking.flat())];
}

/**
 * Drops repeats.
 *
 * Two of an event's own bookings normally cannot clash with each other, but
 * nothing stops the same resource being booked twice against one event by hand,
 * and that pair would then be reported once from each side.
 */
function dedupe(conflicts: readonly Conflict[]): Conflict[] {
  const seen = new Set<string>();
  return conflicts.filter((conflict) => {
    const ends = [conflict.left, conflict.right]
      .map((ref) => (ref.type === "event" ? `e${ref.eventId}` : `a${ref.allocationId}`))
      .sort();
    const key = `${conflict.kind}:${ends.join("-")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Clashes for a booking that already exists. */
export async function conflictsForAllocation(allocationId: number): Promise<Conflict[]> {
  const allocation = await prisma.resourceAllocation.findUnique({
    where: { allocationId },
    select: { resourceId: true, startTime: true, endTime: true, bookableId: true },
  });
  if (!allocation) return [];

  return previewAllocationConflicts({
    resourceId: allocation.resourceId,
    startTime: allocation.startTime,
    endTime: allocation.endTime,
    bookableId: allocation.bookableId,
    excludeAllocationId: allocationId,
  });
}
