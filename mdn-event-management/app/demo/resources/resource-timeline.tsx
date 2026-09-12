"use client";

import { useEffect, useRef, useState } from "react";
import { CrosshairIcon, TriangleAlertIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatDuration } from "@/lib/datetime";
import { resourceTypeStyle } from "@/lib/resourceTypeColor";
import { Button } from "@/components/ui/button";
import {
  buildTimeline,
  isNowVisible,
  nowPct,
  plotWidthPx,
  tickCountFor,
  type Booking,
} from "@/lib/timeline";

/**
 * When a resource is booked, on a shared time axis.
 *
 * One series — this resource's bookings — so one hue (the resource's own type
 * colour, matching its badge everywhere else) and no legend; the heading names
 * it. Conflicts are status, not identity, so they keep the entity colour and are
 * marked with a ring *plus* an icon and the word "Conflict" — never colour alone.
 *
 * Every value is directly labelled, so nothing is hover-only; the `title` on
 * each bar adds the exact timestamps.
 *
 * The plot scrolls horizontally rather than compressing: a shared linear axis
 * would otherwise squash a 3-hour booking to a sliver beside a 20-day one. All
 * tracks and the axis live in one scroll container so they never drift out of
 * alignment, and each row's labels are `sticky left-0` so they stay readable
 * however far the bars are scrolled.
 */
export function ResourceTimeline({
  bookings,
  typeName,
}: {
  bookings: readonly Booking[];
  typeName?: string;
}) {
  // Two passes: widths do not depend on tick count, so measure first, then
  // rebuild with enough ticks to label the widened canvas.
  const plotWidth = plotWidthPx(buildTimeline(bookings));
  const model = buildTimeline(bookings, tickCountFor(plotWidth));
  const barStyle = typeName ? resourceTypeStyle(typeName) : undefined;
  const plotStyle = plotWidth > 0 ? { width: `${plotWidth}px` } : undefined;

  const scrollRef = useRef<HTMLDivElement>(null);
  // Read the clock after mount, never during render: the server and the client
  // would disagree and React would flag a hydration mismatch. Null until then,
  // so the marker simply is not rendered server-side.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    // Deferred rather than called inline so the first paint still matches the
    // server output.
    const first = window.setTimeout(() => setNow(Date.now()), 0);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(first);
    };
  }, []);

  const markerPct = now == null ? null : nowPct(model, now);
  const markerVisible = now != null && isNowVisible(model, now);

  /** Centre the current time in the viewport, clamped to the scroll range. */
  function scrollToNow() {
    const el = scrollRef.current;
    if (!el) return;
    const pct = nowPct(model, Date.now());
    const target = (pct / 100) * el.scrollWidth - el.clientWidth / 2;
    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    el.scrollTo({ left: Math.min(Math.max(target, 0), max), behavior: "smooth" });
  }

  if (model.bookings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Not booked yet. Allocations created for this resource will appear here as a
        timeline.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>
          {model.bookings.length === 1 ? "1 booking" : `${model.bookings.length} bookings`}
        </span>
        {model.conflictCount > 0 && (
          <Badge variant="destructive" className="gap-1">
            <TriangleAlertIcon />
            {model.conflictCount === 1
              ? "1 overlapping booking"
              : `${model.conflictCount} overlapping bookings`}
          </Badge>
        )}
        <Button
          type="button"
          size="xs"
          variant="secondary"
          className="ml-auto"
          onClick={scrollToNow}
          title={
            markerVisible
              ? "Scroll to the current time"
              : "The current time is outside this resource's booked range — scrolls as close as possible"
          }
        >
          <CrosshairIcon />
          Now
        </Button>
      </div>

      {/* One scroll container for every track and the axis, so a bar can never
          drift out of alignment with the dates below it. */}
      <div
        ref={scrollRef}
        className="timeline-scroll min-w-0"
        tabIndex={0}
        role="region"
        aria-label="Booking timeline, scrollable horizontally"
      >
        <div className="relative min-w-full" style={plotStyle}>
          {/* "Now" marker. Lives inside the canvas so it scrolls with the bars,
              and is skipped entirely when the current time falls outside the
              plotted window. */}
          {markerVisible && markerPct != null && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 z-10 w-px bg-foreground/40"
              style={{ left: `${markerPct}%` }}
            >
              <span className="absolute -top-0.5 left-0 size-1.5 -translate-x-1/2 rounded-full bg-foreground/60" />
            </div>
          )}
          <ul className="space-y-3">
            {model.bookings.map((booking) => (
              <li key={booking.allocationId} className="space-y-1.5">
                {/* Pinned to the left edge of the viewport so the labels stay
                    readable however far the bars are scrolled. */}
                <div className="sticky left-0 flex w-fit max-w-full flex-wrap items-baseline gap-x-2 gap-y-1 bg-popover pr-3">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {booking.kind && <Badge variant="secondary">{booking.kind}</Badge>}
                    {booking.label}
                    {booking.conflict && (
                      <span className="flex items-center gap-1 text-xs font-normal text-destructive">
                        <TriangleAlertIcon className="size-3" />
                        Conflict
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatDateTime(booking.startTime)} → {formatDateTime(booking.endTime)}
                    {booking.invalid ? (
                      <span className="text-destructive"> · ends before it starts</span>
                    ) : (
                      <> · {formatDuration(booking.startTime, booking.endTime)}</>
                    )}
                  </span>
                </div>

                {/* Track. Gridlines sit behind the bar and stay hairline-recessive. */}
                <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  {model.ticks.slice(1, -1).map((tick) => (
                    <span
                      key={tick.pct}
                      aria-hidden
                      className="absolute top-0 bottom-0 w-px bg-border"
                      style={{ left: `${tick.pct}%` }}
                    />
                  ))}
                  <span
                    className={
                      booking.invalid || booking.conflict
                        ? "type-dot absolute top-0 bottom-0 rounded-full ring-2 ring-destructive"
                        : "type-dot absolute top-0 bottom-0 rounded-full"
                    }
                    style={{
                      ...barStyle,
                      left: `${booking.startPct}%`,
                      width: `${booking.widthPct}%`,
                    }}
                    title={`${booking.label}: ${formatDateTime(booking.startTime)} → ${formatDateTime(booking.endTime)}`}
                  />
                </div>
              </li>
            ))}
          </ul>

          {/* Shared axis, inside the same scroller and the same width. */}
          <div className="relative mt-3 h-4 w-full" aria-hidden>
            {model.ticks.map((tick, i) => (
              <span
                key={tick.pct}
                className="absolute top-0 text-[0.65rem] whitespace-nowrap text-muted-foreground tabular-nums"
                style={{
                  left: `${tick.pct}%`,
                  // Keep the first and last labels inside the plot rather than
                  // letting them bleed past its edges.
                  transform:
                    i === 0
                      ? "none"
                      : i === model.ticks.length - 1
                        ? "translateX(-100%)"
                        : "translateX(-50%)",
                }}
              >
                {tick.label}
              </span>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
