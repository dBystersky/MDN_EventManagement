/**
 * Date helpers shared by the demo pages.
 *
 * Lifted from the inline copies in `app/(crud)/events/page.tsx`; the events page
 * keeps its own for now so its diff stays at zero, and can adopt these later.
 */

/**
 * Default span offered when only one instant is known.
 *
 * Events now carry a real start and end, so this is a convenience default the
 * forms prefill — not an assumption about how long anything runs. It also stands
 * in as the booking window for a task, whose `deadline` is genuinely a point in
 * time rather than a range.
 *
 * Lives here rather than in `lib/resourceAllocations.ts` because the client
 * forms need it, and importing from that module would pull Prisma into the
 * browser bundle.
 */
export const DEFAULT_BOOKING_DURATION_MS = 2 * 60 * 60 * 1000;

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

/**
 * A `datetime-local` value → the same format, `DEFAULT_BOOKING_DURATION_MS` later.
 *
 * Used to prefill an end time once a start is picked, so nobody has to type the
 * common case twice. Returns "" for an unparseable start, which the callers read
 * as "leave the end alone".
 *
 * Adds elapsed milliseconds, not wall-clock hours: a two-hour booking across a
 * DST change is still two hours of the room being occupied.
 */
export function defaultEndFor(startLocal: string): string {
  const parsed = new Date(startLocal);
  if (Number.isNaN(parsed.getTime())) return "";
  const end = new Date(parsed.getTime() + DEFAULT_BOOKING_DURATION_MS);
  return toDatetimeLocal(end.toISOString());
}
