import { Badge } from "@/components/ui/badge";
import { TASK_STATUSES, TASK_STATUS_LABELS, type TaskStatus } from "@/lib/permissions";
import { cn } from "@/lib/utils";

/**
 * How a task status is shown, in one place — RTM Req 12.
 *
 * Shared by the tasks table and the overview so a status has the same colour
 * wherever it appears. Every badge also shows the status name, so the colour is
 * never the only cue.
 */

const STATUS_CLASS: Record<TaskStatus, string> = {
  backlog: "border-border bg-muted text-muted-foreground",
  ready_to_do:
    "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:border-sky-400/30 dark:bg-sky-400/15 dark:text-sky-300",
  in_progress:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/15 dark:text-amber-300",
  blocked: "border-destructive/20 bg-destructive/10 text-destructive dark:bg-destructive/20",
  done: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/15 dark:text-emerald-300",
};

/**
 * Value → label pairs for a status `Select`. Without `items` the trigger shows
 * the raw value (`in_progress`) instead of the label.
 */
export const TASK_STATUS_ITEMS = TASK_STATUSES.map((value) => ({
  value,
  label: TASK_STATUS_LABELS[value],
}));

export function TaskStatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn(STATUS_CLASS[status], className)}>
      {TASK_STATUS_LABELS[status]}
    </Badge>
  );
}
