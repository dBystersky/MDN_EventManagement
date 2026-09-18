import fuzzysort, { type Result } from "fuzzysort";

/**
 * Fuzzy filtering for the tasks table.
 *
 * Mirrors `lib/fuzzyAllocations.ts` rather than generalising it. Searches the
 * task name, description, linked event, and manager names so "slides", an
 * event title, or a member name all narrow the table.
 */

export type SearchableTask = {
  taskId: number;
  name: string;
  description?: string | null;
  deadline: string;
  eventId?: number | null;
  taskManagers?: { memberId: number; member?: { name: string } | null }[];
};

export function eventNameOf(
  task: SearchableTask,
  eventNames: ReadonlyMap<number, string>,
): string {
  if (task.eventId == null) return "";
  return eventNames.get(task.eventId) ?? "";
}

export function managerNamesOf(task: SearchableTask): string {
  return (task.taskManagers ?? [])
    .map((tm) => tm.member?.name ?? "")
    .filter(Boolean)
    .join(", ");
}

export type TaskMatch<T> = {
  task: T;
  /** Match detail for the name field, for highlighting. Null when unfiltered
   *  or when the row matched on description, event, or managers instead. */
  nameMatch: Result | null;
};

/**
 * fuzzysort v4 scores 0–1 and defaults threshold to 0.5, which is too strict
 * for a filter box — it drops gapped queries. Same permissive setting proven on
 * the resources and allocations tables.
 */
const MIN_SCORE = 0.2;

export function searchTasks<T extends SearchableTask>(
  query: string,
  tasks: readonly T[],
  eventNames: ReadonlyMap<number, string>,
): TaskMatch<T>[] {
  const trimmed = query.trim();

  // No query: keep the API's own `deadline asc` ordering rather than scoring.
  if (!trimmed) {
    return tasks.map((task) => ({ task, nameMatch: null }));
  }

  const results = fuzzysort.go(trimmed, tasks, {
    keys: [
      (task) => task.name,
      (task) => task.description ?? "",
      (task) => eventNameOf(task, eventNames),
      (task) => managerNamesOf(task),
    ],
    threshold: MIN_SCORE,
    limit: 0,
  });

  return [...results]
    // Equal scores otherwise tie-break arbitrarily, making the table reorder
    // unpredictably between keystrokes. Deadline is the stable fallback.
    .sort(
      (a, b) =>
        b.score - a.score || a.obj.deadline.localeCompare(b.obj.deadline),
    )
    .map((result) => ({
      task: result.obj,
      nameMatch: result[0] && result[0].score > 0 ? result[0] : null,
    }));
}
