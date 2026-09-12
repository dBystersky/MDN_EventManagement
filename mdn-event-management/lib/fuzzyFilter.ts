import fuzzysort from "fuzzysort";

/**
 * Per-item fuzzy predicate for Base UI's Combobox `filter` prop.
 *
 * The Combobox filter is a boolean test per item rather than a ranker, so this
 * thresholds fuzzysort's score instead of sorting. That is the better fit here:
 * the list keeps its natural order (resources by name, bookables grouped by
 * kind) rather than reshuffling on every keystroke.
 */

/** fuzzysort v4 scores 0-1 and defaults to 0.5, too strict for a typeahead. */
const MIN_SCORE = 0.2;

export function fuzzyMatches(haystack: string, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;
  const result = fuzzysort.single(trimmed, haystack);
  return result != null && result.score >= MIN_SCORE;
}
