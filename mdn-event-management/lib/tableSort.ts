/**
 * Column sorting for the data tables.
 *
 * Pure, like `lib/conflicts.ts`, so the ordering rules are unit-tested without
 * a browser. `hooks/use-table-sort.ts` holds the click state; this file only
 * decides how two values compare.
 */

export type SortDirection = "asc" | "desc";
export type SortState<K extends string> = { key: K; direction: SortDirection } | null;
export type SortValue = string | number | null | undefined;
export type SortAccessors<T, K extends string> = Record<K, (row: T) => SortValue>;

function isBlank(value: SortValue): value is null | undefined | "" {
  return value == null || value === "" || (typeof value === "number" && Number.isNaN(value));
}

/** Ascending order: numbers numerically, text case-insensitively with "2" < "10". */
export function compareSortValues(a: SortValue, b: SortValue): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

/**
 * A sorted copy of `rows`, or `rows` itself when no column is sorted so the
 * caller's own order (search relevance, newest first) shows through. Blank
 * values sink to the bottom in both directions — an empty budget is not
 * "cheapest". Ties keep their incoming order.
 */
export function sortRows<T, K extends string>(
  rows: readonly T[],
  sort: SortState<K>,
  accessors: SortAccessors<T, K>,
): readonly T[] {
  if (!sort) return rows;
  const get = accessors[sort.key];
  const sign = sort.direction === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, value: get(row) }))
    .sort((a, b) => {
      const aBlank = isBlank(a.value);
      const bBlank = isBlank(b.value);
      if (aBlank || bBlank) return aBlank === bBlank ? a.index - b.index : aBlank ? 1 : -1;
      return sign * compareSortValues(a.value, b.value) || a.index - b.index;
    })
    .map(({ row }) => row);
}

/** One header click: a new column starts ascending, then descending, then off. */
export function nextSort<K extends string>(current: SortState<K>, key: K): SortState<K> {
  if (current?.key !== key) return { key, direction: "asc" };
  return current.direction === "asc" ? { key, direction: "desc" } : null;
}
