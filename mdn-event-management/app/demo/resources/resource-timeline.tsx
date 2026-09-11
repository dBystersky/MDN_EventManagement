"use client";

import { TriangleAlertIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatDuration } from "@/lib/datetime";
import { resourceTypeStyle } from "@/lib/resourceTypeColor";
import { buildTimeline, type Booking } from "@/lib/timeline";

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
 */
export function ResourceTimeline({
  bookings,
  typeName,
}: {
  bookings: readonly Booking[];
  typeName?: string;
}) {
  const model = buildTimeline(bookings);
  const barStyle = typeName ? resourceTypeStyle(typeName) : undefined;

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
      </div>

      <ul className="space-y-3">
        {model.bookings.map((booking) => (
          <li key={booking.allocationId} className="space-y-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
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

      {/* Shared axis, aligned with the tracks above. */}
      <div className="relative h-4 w-full" aria-hidden>
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
  );
}
