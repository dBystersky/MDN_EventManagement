"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CircleAlertIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiJson } from "@/lib/api-json";
import { formatDateTime } from "@/lib/datetime";
import { TASK_STATUS_LABELS, isMember, type Actor, type TaskStatus } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type EventItem = {
  eventId: number;
  name: string;
  date: string;
  endDate: string;
  location?: { name: string } | null;
};

type TaskItem = {
  taskId: number;
  name: string;
  deadline: string;
  status: TaskStatus;
  eventId?: number | null;
  taskManagers?: { memberId: number; member?: { name: string } | null }[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const UPCOMING_EVENTS = 6;
const UPCOMING_TASKS = 8;
const WEEK_DAYS = 7;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** "Today", "Tomorrow", "In 3 days" or "2 days ago", by calendar day. */
function relativeDay(value: string, today: Date) {
  const days = Math.round((startOfDay(new Date(value)).getTime() - today.getTime()) / DAY_MS);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return days > 0 ? `In ${days} days` : `${-days} days ago`;
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "alert" }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle
          className={cn(
            "text-3xl tabular-nums",
            tone === "alert" && value > 0 && "text-destructive",
          )}
        >
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

export default function OverviewPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [actor, setActor] = useState<Actor>({ role: null, memberId: null });
  const [name, setName] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([apiJson("/api/events"), apiJson("/api/tasks"), apiJson("/api/auth/me")])
      .then(([eventList, taskList, me]) => {
        setEvents(eventList);
        setTasks(taskList);
        setName(me?.user?.name ?? "");
        setActor({ role: me?.user?.role ?? null, memberId: me?.user?.member_id ?? null });
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoaded(true));
  }, []);

  const today = useMemo(() => startOfDay(new Date()), []);

  const upcomingEvents = useMemo(
    () =>
      events
        .filter((e) => new Date(e.endDate) >= new Date())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [events],
  );

  const isMine = (task: TaskItem) =>
    actor.memberId != null && !!task.taskManagers?.some((tm) => tm.memberId === actor.memberId);

  const openTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== "done")
        .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()),
    [tasks],
  );
  const shownTasks = onlyMine ? openTasks.filter(isMine) : openTasks;

  const overdue = openTasks.filter((t) => new Date(t.deadline) < new Date());
  const dueThisWeek = openTasks.filter((t) => {
    const d = new Date(t.deadline);
    return d >= new Date() && d < new Date(today.getTime() + WEEK_DAYS * DAY_MS);
  });
  const blocked = openTasks.filter((t) => t.status === "blocked");

  // The next seven days, each with what happens on it.
  const week = Array.from({ length: WEEK_DAYS }, (_, i) => {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const key = dayKey(day);
    return {
      day,
      events: events.filter((e) => dayKey(new Date(e.date)) === key),
      tasks: openTasks.filter((t) => dayKey(new Date(t.deadline)) === key),
    };
  });

  const eventNames = new Map(events.map((e) => [e.eventId, e.name]));

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{name ? `Welcome back, ${name}` : "Overview"}</h1>
          <p className="text-sm text-muted-foreground">
            {isMember(actor)
              ? "What's coming up in your events."
              : "What's coming up across the club."}
          </p>
        </div>
        <Link href="/calendar" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Full calendar
        </Link>
      </header>

      {error && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Upcoming events" value={upcomingEvents.length} />
        <Stat label="Tasks due this week" value={dueThisWeek.length} />
        <Stat label="Overdue tasks" value={overdue.length} tone="alert" />
        <Stat label="Blocked tasks" value={blocked.length} tone="alert" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Next 7 days</CardTitle>
          <CardDescription>Events starting and tasks due, day by day.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {week.map(({ day, events: dayEvents, tasks: dayTasks }, i) => (
              <div
                key={dayKey(day)}
                className={cn(
                  "min-h-24 min-w-0 rounded-lg p-2 ring-1 ring-foreground/10",
                  i === 0 && "bg-accent/50 ring-primary",
                )}
              >
                <p className="text-xs font-medium">
                  {i === 0
                    ? "Today"
                    : day.toLocaleDateString("en-AU", { weekday: "short", day: "numeric" })}
                </p>
                <ul className="mt-1 space-y-1">
                  {dayEvents.map((e) => (
                    <li key={`e${e.eventId}`}>
                      <Badge className="max-w-full justify-start truncate">{e.name}</Badge>
                    </li>
                  ))}
                  {dayTasks.map((t) => (
                    <li key={`t${t.taskId}`}>
                      <Badge variant="outline" className="max-w-full justify-start truncate">
                        {t.name}
                      </Badge>
                    </li>
                  ))}
                </ul>
                {dayEvents.length === 0 && dayTasks.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">Nothing</p>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Filled badges are events; outlined badges are tasks.
          </p>
        </CardContent>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming events</CardTitle>
            <CardDescription>
              {isMember(actor) ? "Events you belong to." : "Next events on the calendar."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!loaded ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : upcomingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming events.</p>
            ) : (
              <ul className="space-y-3">
                {upcomingEvents.slice(0, UPCOMING_EVENTS).map((e) => (
                  <li
                    key={e.eventId}
                    className="flex items-start justify-between gap-3 rounded-xl bg-muted p-3 ring-1 ring-foreground/10"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{e.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(e.date)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant="secondary">{relativeDay(e.date, today)}</Badge>
                      {e.location?.name && (
                        <span className="max-w-40 truncate text-xs text-muted-foreground">
                          {e.location.name}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {upcomingEvents.length > UPCOMING_EVENTS && (
              <Link
                href="/events"
                className={cn(buttonVariants({ variant: "link", size: "sm" }), "mt-2 px-0")}
              >
                View all {upcomingEvents.length} events
              </Link>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>Tasks due</CardTitle>
                <CardDescription>Open tasks, soonest deadline first.</CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                variant={onlyMine ? "default" : "outline"}
                onClick={() => setOnlyMine((v) => !v)}
              >
                {onlyMine ? "Showing mine" : "Show mine"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!loaded ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : shownTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {onlyMine ? "Nothing assigned to you is open." : "No open tasks."}
              </p>
            ) : (
              <ul className="space-y-3">
                {shownTasks.slice(0, UPCOMING_TASKS).map((t) => {
                  const late = new Date(t.deadline) < new Date();
                  const eventName = t.eventId != null ? eventNames.get(t.eventId) : null;
                  return (
                    <li
                      key={t.taskId}
                      className="flex items-start justify-between gap-3 rounded-xl bg-muted p-3 ring-1 ring-foreground/10"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {eventName ? `${eventName} · ` : ""}
                          {formatDateTime(t.deadline)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge variant={late ? "destructive" : "secondary"}>
                          {relativeDay(t.deadline, today)}
                        </Badge>
                        <Badge variant="outline">{TASK_STATUS_LABELS[t.status]}</Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {shownTasks.length > UPCOMING_TASKS && (
              <Link
                href="/tasks"
                className={cn(buttonVariants({ variant: "link", size: "sm" }), "mt-2 px-0")}
              >
                View all {shownTasks.length} tasks
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
