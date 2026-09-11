import fuzzysort, { type Result } from "fuzzysort";

/**
 * Fuzzy filtering for the resources table.
 *
 * Searches two fields — the resource name and the name of its type — so typing
 * "venue" surfaces every resource of that type, not just ones with "venue" in
 * their own name.
 */

export type SearchableResource = {
  resourceId: number;
  name: string;
  resourceType: number;
  resourceTypeRel?: { typeId: number; name: string };
};

export type ResourceTypeOption = { typeId: number; name: string };

/**
 * A resource's type name, preferring the relation the API includes and falling
 * back to a lookup through the separately-fetched type list.
 */
export function typeNameOf(
  resource: SearchableResource,
  types: readonly ResourceTypeOption[],
): string | undefined {
  return (
    resource.resourceTypeRel?.name ??
    types.find((type) => type.typeId === resource.resourceType)?.name
  );
}

export type ResourceMatch<T> = {
  resource: T;
  /** Match detail for the name field, for highlighting. Null when unfiltered,
   *  or when the row matched on its type rather than its name. */
  nameMatch: Result | null;
};

/**
 * fuzzysort v4 scores 0–1 (1 exact, 0.5 good, 0 no match) and defaults
 * threshold to 0.5, which is too strict for a filter box — it drops gapped
 * queries like "hll a" for "Hall A". This is deliberately permissive; the
 * ranking still puts the best matches on top.
 */
const MIN_SCORE = 0.2;

export function searchResources<T extends SearchableResource>(
  query: string,
  resources: readonly T[],
  types: readonly ResourceTypeOption[],
): ResourceMatch<T>[] {
  const trimmed = query.trim();

  // No query: preserve the API's own `name asc` ordering rather than scoring.
  if (!trimmed) {
    return resources.map((resource) => ({ resource, nameMatch: null }));
  }

  const results = fuzzysort.go(trimmed, resources, {
    keys: [(resource) => resource.name, (resource) => typeNameOf(resource, types) ?? ""],
    threshold: MIN_SCORE,
    limit: 0, // unlimited; the list is already client-side and small
  });

  return [...results]
    // Equal scores otherwise tie-break arbitrarily, which makes the table
    // reorder unpredictably between keystrokes. Name is the stable fallback.
    .sort((a, b) => b.score - a.score || a.obj.name.localeCompare(b.obj.name))
    .map((result) => ({
      resource: result.obj,
      nameMatch: result[0] && result[0].score > 0 ? result[0] : null,
    }));
}
