/**
 * Date helpers shared by the demo pages.
 *
 * Lifted from the inline copies in `app/demo/events/page.tsx`; the events page
 * keeps its own for now so its diff stays at zero, and can adopt these later.
 */

/**
 * ISO timestamp → the `YYYY-MM-DDTHH:mm` a `datetime-local` input expects.
 * Shifts by the local offset first, because `toISOString` is UTC and the input
 * is read as local time — without this, edits silently move a booking by the
 * timezone offset every time the form is opened and saved.
 */
export function toDatetimeLocal(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/** Human-readable timestamp, or the raw value back if it will not parse. */
export function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Compact span between two timestamps, e.g. "2h", "45m", "20d 1h". Returns null
 * if either end will not parse or the range is inverted — an inverted range is
 * a data bug worth showing as such rather than as a negative duration.
 */
export function formatDuration(start: string, end: string): string | null {
  const from = new Date(start).getTime();
  const to = new Date(end).getTime();
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return null;

  const minutes = Math.round((to - from) / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;

  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (mins && !days) parts.push(`${mins}m`);
  return parts.length > 0 ? parts.join(" ") : "0m";
}
