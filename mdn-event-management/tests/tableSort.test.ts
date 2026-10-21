/**
 * Table column sorting. `lib/tableSort.ts` is pure, so no browser is needed.
 */

import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { compareSortValues, nextSort, sortRows, type SortState } from "../lib/tableSort.ts";

type Row = { id: number; name: string | null; budget?: number | null };

const accessors = {
  id: (row: Row) => row.id,
  name: (row: Row) => row.name,
  budget: (row: Row) => row.budget,
};
type Key = keyof typeof accessors;

const ids = (rows: readonly Row[]) => rows.map((row) => row.id);

describe("compareSortValues", () => {
  it("compares numbers numerically", () => {
    assert.ok(compareSortValues(2, 10) < 0);
  });

  it("orders text naturally and ignores case", () => {
    assert.ok(compareSortValues("Room 2", "Room 10") < 0);
    assert.equal(compareSortValues("hall", "Hall"), 0);
  });

  it("orders ISO timestamps chronologically", () => {
    assert.ok(compareSortValues("2026-01-02T09:00:00.000Z", "2026-01-10T08:00:00.000Z") < 0);
  });
});

describe("sortRows", () => {
  const rows: Row[] = [
    { id: 3, name: "banana", budget: 50 },
    { id: 1, name: null, budget: null },
    { id: 2, name: "Apple", budget: 5 },
    { id: 4, name: "", budget: 50 },
  ];

  it("returns the input order when nothing is sorted", () => {
    assert.equal(sortRows(rows, null, accessors), rows);
  });

  it("sorts ascending and descending", () => {
    assert.deepEqual(ids(sortRows(rows, { key: "id", direction: "asc" }, accessors)), [1, 2, 3, 4]);
    assert.deepEqual(
      ids(sortRows(rows, { key: "id", direction: "desc" }, accessors)),
      [4, 3, 2, 1],
    );
  });

  it("keeps blank values last in both directions", () => {
    assert.deepEqual(
      ids(sortRows(rows, { key: "name", direction: "asc" }, accessors)),
      [2, 3, 1, 4],
    );
    assert.deepEqual(
      ids(sortRows(rows, { key: "name", direction: "desc" }, accessors)),
      [3, 2, 1, 4],
    );
  });

  it("keeps ties in their incoming order", () => {
    assert.deepEqual(
      ids(sortRows(rows, { key: "budget", direction: "asc" }, accessors)),
      [2, 3, 4, 1],
    );
    assert.deepEqual(
      ids(sortRows(rows, { key: "budget", direction: "desc" }, accessors)),
      [3, 4, 2, 1],
    );
  });

  it("does not mutate the input", () => {
    const before = ids(rows);
    sortRows(rows, { key: "id", direction: "desc" }, accessors);
    assert.deepEqual(ids(rows), before);
  });
});

describe("nextSort", () => {
  it("cycles a column ascending → descending → off", () => {
    let sort: SortState<Key> = null;
    sort = nextSort(sort, "name");
    assert.deepEqual(sort, { key: "name", direction: "asc" });
    sort = nextSort(sort, "name");
    assert.deepEqual(sort, { key: "name", direction: "desc" });
    assert.equal(nextSort(sort, "name"), null);
  });

  it("starts a different column ascending", () => {
    assert.deepEqual(nextSort({ key: "name", direction: "desc" }, "id"), {
      key: "id",
      direction: "asc",
    });
  });
});
