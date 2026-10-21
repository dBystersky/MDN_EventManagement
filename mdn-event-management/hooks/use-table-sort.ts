"use client";

import { useMemo, useState } from "react";

import { nextSort, sortRows, type SortAccessors, type SortState } from "@/lib/tableSort";

/**
 * Click-to-sort state for one table. `toggle` cycles a column through
 * ascending → descending → off; while off, `sorted` is `rows` as given.
 *
 * `accessors` should be stable (module scope or `useMemo`) or the sort reruns
 * on every render.
 */
export function useTableSort<T, K extends string>(
  rows: readonly T[],
  accessors: SortAccessors<T, K>,
) {
  const [sort, setSort] = useState<SortState<K>>(null);
  const sorted = useMemo(() => sortRows(rows, sort, accessors), [rows, sort, accessors]);
  const toggle = (key: K) => setSort((current) => nextSort(current, key));
  return { sorted, sort, toggle };
}
