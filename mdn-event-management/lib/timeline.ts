/**
 * Geometry for the resource booking timeline.
 *
 * Kept free of React so the positioning maths — which is where a timeline
 * actually goes wrong — can be tested directly.
 */

export type Booking = {
  allocationId: number;
  startTime: string;
  endTime: string;
  /** What the resource is booked for, e.g. "Launch Night". */
  label: string;
  /** "Event" | "Task", for the badge beside the label. */
  kind?: string;
};

export type PositionedBooking = Booking & {
  start: number;
  end: number;
  /** Percentages across the plot area. */
  startPct: number;
  widthPct: number;
  /** True when this booking starts before the previous one ends — a resource
   *  double-booked with itself. */
  conflict: boolean;
  /** True when end is at or before start; the row is unrenderable as a span. */
  invalid: boolean;
};

export type TimelineTick = { pct: number; label: string };

export type TimelineModel = {
  bookings: PositionedBooking[];
  domainStart: number;
  domainEnd: number;
  ticks: TimelineTick[];
  conflictCount: number;
};

/** A zero-width domain cannot be divided; give a single instant an hour of air. */
const MIN_DOMAIN_MS = 60 * 60 * 1000;
/** Sub-pixel bars are unclickable; floor every span at a visible sliver. */
const MIN_WIDTH_PCT = 0.75;

function tickLabel(time: number, spanMs: number): string {
  const d = new Date(time);
  // Over a week, the clock time is noise; under a day, the date is.
  if (spanMs > 7 * 24 * 60 * 60 * 1000) {
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  }
  if (spanMs > 24 * 60 * 60 * 1000) {
    return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric" });
  }
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function buildTimeline(bookings: readonly Booking[], tickCount = 4): TimelineModel {
  const parsed = bookings
    .map((b) => ({
      ...b,
      start: new Date(b.startTime).getTime(),
      end: new Date(b.endTime).getTime(),
    }))
    .filter((b) => !Number.isNaN(b.start) && !Number.isNaN(b.end))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  if (parsed.length === 0) {
    return { bookings: [], domainStart: 0, domainEnd: 0, ticks: [], conflictCount: 0 };
  }

  const rawStart = Math.min(...parsed.map((b) => b.start));
  // An invalid row must not drag the domain backwards, so ignore ends < start.
  const rawEnd = Math.max(...parsed.map((b) => Math.max(b.end, b.start)));
  const rawSpan = Math.max(rawEnd - rawStart, MIN_DOMAIN_MS);
  // 4% padding each side keeps the first and last bar off the plot edges.
  const pad = rawSpan * 0.04;
  const domainStart = rawStart - pad;
  const domainEnd = rawEnd + pad;
  const span = domainEnd - domainStart;

  let furthestEnd = -Infinity;
  let conflictCount = 0;

  const positioned: PositionedBooking[] = parsed.map((b) => {
    const invalid = b.end <= b.start;
    // Compare against the furthest end seen so far, not the previous row's:
    // a long booking can overlap several later ones.
    const conflict = b.start < furthestEnd;
    if (conflict) conflictCount += 1;
    furthestEnd = Math.max(furthestEnd, b.end);

    const startPct = ((b.start - domainStart) / span) * 100;
    const rawWidth = ((Math.max(b.end, b.start) - b.start) / span) * 100;

    return {
      ...b,
      invalid,
      conflict,
      startPct,
      widthPct: Math.max(rawWidth, MIN_WIDTH_PCT),
    };
  });

  const ticks: TimelineTick[] = [];
  for (let i = 0; i <= tickCount; i += 1) {
    const pct = (i / tickCount) * 100;
    ticks.push({
      pct,
      label: tickLabel(domainStart + (span * i) / tickCount, span),
    });
  }

  return { bookings: positioned, domainStart, domainEnd, ticks, conflictCount };
}
