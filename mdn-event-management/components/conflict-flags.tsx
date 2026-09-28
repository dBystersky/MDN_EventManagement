"use client";

import { TriangleAlertIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/datetime";
import type { Conflict, ConflictKind } from "@/lib/conflicts";

/**
 * How a clash is shown, in one place — RTM Req 7.
 *
 * Shared by the events list, the event form and the allocations page so the same
 * clash never reads differently depending on where it surfaces. Severity maps
 * onto variants that already exist rather than inventing a "warning" one:
 * `venue`/`resource` are real double-bookings and get the destructive treatment,
 * a `schedule` overlap is only a heads-up.
 *
 * Never colour alone: every flag carries the warning icon and names the kind in
 * words, the rule `resource-timeline.tsx` already follows.
 */

const KIND_LABEL: Record<ConflictKind, string> = {
  venue: "Venue clash",
  resource: "Resource clash",
  schedule: "Time clash",
};

/** A single error outweighs any number of warnings. */
function isError(conflicts: readonly Conflict[]): boolean {
  return conflicts.some((conflict) => conflict.severity === "error");
}

/**
 * Compact flag for a table or list row. The detail lives in the form and dialog
 * alerts; this says which kind and how many, so it is readable on its own.
 */
export function ConflictBadge({
  conflicts,
  className,
}: {
  conflicts: readonly Conflict[];
  className?: string;
}) {
  if (conflicts.length === 0) return null;

  const label =
    conflicts.length === 1
      ? KIND_LABEL[conflicts[0].kind]
      : `${conflicts.length} clashes`;

  return (
    <Badge
      variant={isError(conflicts) ? "destructive" : "secondary"}
      className={className}
      title={conflicts.map((conflict) => conflict.message).join("\n")}
    >
      <TriangleAlertIcon />
      {label}
    </Badge>
  );
}

/**
 * The full explanation: what clashes, and over which window.
 *
 * `hint` is where callers say that saving is still allowed — the requirement is
 * to flag a clash, not to prevent one, and a warning that looks like a blocker
 * is worse than no warning.
 */
export function ConflictAlert({
  conflicts,
  title,
  hint,
}: {
  conflicts: readonly Conflict[];
  title?: string;
  hint?: string;
}) {
  if (conflicts.length === 0) return null;

  const error = isError(conflicts);

  return (
    <Alert variant={error ? "destructive" : "default"}>
      <TriangleAlertIcon />
      <AlertTitle>
        {title ?? (error ? "This clashes with an existing booking" : "Worth a look")}
      </AlertTitle>
      <AlertDescription>
        <ul className="space-y-1.5">
          {conflicts.map((conflict, index) => (
            <li key={`${conflict.kind}-${index}`}>
              <span className="font-medium">{KIND_LABEL[conflict.kind]}:</span>{" "}
              {conflict.message}
              <span className="block text-xs tabular-nums opacity-80">
                {formatDateTime(conflict.window.start)} →{" "}
                {formatDateTime(conflict.window.end)}
              </span>
            </li>
          ))}
        </ul>
        {hint && <p className="mt-2 text-xs opacity-80">{hint}</p>}
      </AlertDescription>
    </Alert>
  );
}
