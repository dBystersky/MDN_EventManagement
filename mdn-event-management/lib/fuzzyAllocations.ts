import fuzzysort, { type Result } from "fuzzysort";

/**
 * Fuzzy filtering for the allocations table.
 *
 * Mirrors `lib/fuzzyResources.ts` rather than generalising it: making that one
 * generic would mean editing the resources page, which works, for no visible
 * gain. Searches the resource name, its type name, and the booking target, so
 * "projector", "hall" and "Event: Launch" all narrow the table.
 */

export type SearchableAllocation = {
  allocationId: number;
  bookableId: number;
  startTime: string;
  endTime: string;
  resource?: {
    name: string;
    resourceTypeRel?: { typeId: number; name: string };
  };
  bookable?: { bookableId: number; bookableType: string };
};

/** Human label for what an allocation is booked against, e.g. "Event: Launch". */
export function bookableLabelOf(
  allocation: SearchableAllocation,
  labels: ReadonlyMap<number, string>,
): string {
  const name = labels.get(allocation.bookableId);
  const kind = allocation.bookable?.bookableType;
  if (name) return name;
  return kind ? `${kind} #${allocation.bookableId}` : `#${allocation.bookableId}`;
}

export type AllocationMatch<T> = {
  allocation: T;
  /** Match detail for the resource name, for highlighting. Null when unfiltered
   *  or when the row matched on its type or booking target instead. */
  resourceMatch: Result | null;
};

/**
 * fuzzysort v4 scores 0–1 and defaults threshold to 0.5, which is too strict
 * for a filter box — it drops gapped queries. Same permissive setting proven on
 * the resources table.
 */
const MIN_SCORE = 0.2;

export function searchAllocations<T extends SearchableAllocation>(
  query: string,
  allocations: readonly T[],
  labels: ReadonlyMap<number, string>,
): AllocationMatch<T>[] {
  const trimmed = query.trim();

  // No query: keep the API's own `startTime asc` ordering rather than scoring.
  if (!trimmed) {
    return allocations.map((allocation) => ({ allocation, resourceMatch: null }));
  }

  const results = fuzzysort.go(trimmed, allocations, {
    keys: [
      (allocation) => allocation.resource?.name ?? "",
      (allocation) => allocation.resource?.resourceTypeRel?.name ?? "",
      (allocation) => bookableLabelOf(allocation, labels),
    ],
    threshold: MIN_SCORE,
    limit: 0,
  });

  return [...results]
    // Equal scores otherwise tie-break arbitrarily, making the table reorder
    // unpredictably between keystrokes. Start time is the stable fallback.
    .sort(
      (a, b) =>
        b.score - a.score || a.obj.startTime.localeCompare(b.obj.startTime),
    )
    .map((result) => ({
      allocation: result.obj,
      resourceMatch: result[0] && result[0].score > 0 ? result[0] : null,
    }));
}
