"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, CircleAlertIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiJson } from "@/lib/api-json";
import { formatDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";

type EventItem = {
  eventId: number;
  name: string;
  description?: string | null;
  date: string;
  location?: { locationId: number; name: string } | null;
  totalBudget?: string;
  eventManagers?: { memberId: number; member?: { name: string } | null }[];
  tasks?: { taskId: number; name: string; deadline: string }[];
};

type TaskItem = {
  taskId: number;
  name: string;
  deadline: string;
  eventId?: number | null;
};

type DayItem = {
  type: "event" | "task";
  id: number;
  name: string;
  time: string;
  eventName?: string;
  event?: EventItem;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function shiftMonth(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Grid always starts on a Sunday and ends on a Saturday, sized to whatever
 *  number of weeks (5 or 6) the month actually needs. */
function buildMonthGrid(viewDate: Date): Date[] {
  const first = startOfMonth(viewDate);
  const startOffset = first.getDay();
  const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - startOffset);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const weeks = Math.ceil((startOffset + daysInMonth) / 7);
  return Array.from(
    { length: weeks * 7 },
    (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i),
  );
}

function formatTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatBudget(value: string | undefined): string | null {
  if (value == null || value === "") return null;
  return `$${value}`;
}

export default function CalendarPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [error, setError] = useState("");

  const [viewDate, setViewDate] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [showEvents, setShowEvents] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [previewEvent, setPreviewEvent] = useState<EventItem | null>(null);

  async function refresh() {
    const [eventList, taskList] = await Promise.all([
      apiJson("/api/events"),
      apiJson("/api/tasks"),
    ]);
    setEvents(eventList);
    setTasks(taskList);
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, []);

  const eventNames = useMemo(
    () => new Map(events.map((event) => [event.eventId, event.name])),
    [events],
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const event of events) {
      const key = toDateKey(new Date(event.date));
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    return map;
  }, [events]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskItem[]>();
    for (const task of tasks) {
      const key = toDateKey(new Date(task.deadline));
      map.set(key, [...(map.get(key) ?? []), task]);
    }
    return map;
  }, [tasks]);

  function itemsForDay(key: string): DayItem[] {
    const dayEvents = showEvents ? eventsByDay.get(key) ?? [] : [];
    const dayTasks = showTasks ? tasksByDay.get(key) ?? [] : [];
    return [
      ...dayEvents.map((event) => ({
        type: "event" as const,
        id: event.eventId,
        name: event.name,
        time: event.date,
        event,
      })),
      ...dayTasks.map((task) => ({
        type: "task" as const,
        id: task.taskId,
        name: task.name,
        time: task.deadline,
        eventName: task.eventId != null ? eventNames.get(task.eventId) : undefined,
      })),
    ].sort((a, b) => a.time.localeCompare(b.time));
  }

  const days = useMemo(() => buildMonthGrid(viewDate), [viewDate]);
  const todayKey = toDateKey(new Date());
  const selectedKey = toDateKey(selectedDate);
  const selectedItems = itemsForDay(selectedKey);

  function goToday() {
    const now = new Date();
    setViewDate(startOfMonth(now));
    setSelectedDate(now);
  }

  return (
    <section className="relative left-1/2 w-screen -translate-x-1/2 -my-8 min-h-[calc(100vh-3.25rem)] bg-linear-to-b from-primary from-0% via-primary via-[45%] to-secondary px-6 py-8 md:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <h1 className="font-heading text-3xl font-medium tracking-tight text-primary-foreground">
            Calendar
          </h1>
        </header>

        {error && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Month view</CardTitle>
            <CardDescription>
              Events land on their date, tasks on their deadline. Select a day to see the details.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label="Previous month"
                  onClick={() => setViewDate((d) => shiftMonth(d, -1))}
                >
                  <ChevronLeftIcon />
                </Button>
                <h2 className="min-w-40 text-center font-heading text-lg font-medium">
                  {viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                </h2>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label="Next month"
                  onClick={() => setViewDate((d) => shiftMonth(d, 1))}
                >
                  <ChevronRightIcon />
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={goToday}>
                  Today
                </Button>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={showEvents ? "default" : "outline"}
                  onClick={() => setShowEvents((v) => !v)}
                >
                  Events
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={showTasks ? "secondary" : "outline"}
                  onClick={() => setShowTasks((v) => !v)}
                >
                  Tasks
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="px-1 pb-1 text-center text-xs font-medium text-muted-foreground"
                >
                  {day}
                </div>
              ))}
              {days.map((day) => {
                const key = toDateKey(day);
                const inMonth = day.getMonth() === viewDate.getMonth();
                const isToday = key === todayKey;
                const isSelected = key === selectedKey;
                const items = itemsForDay(key);
                const visible = items.slice(0, 3);
                const overflow = items.length - visible.length;

                return (
                  <div
                    key={key}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedDate(day)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setSelectedDate(day);
                    }}
                    className={cn(
                      "flex min-h-24 cursor-pointer flex-col items-start gap-1 rounded-lg border p-1.5 text-left transition-colors",
                      inMonth ? "bg-card" : "bg-muted/40 text-muted-foreground",
                      isSelected ? "ring-2 ring-primary" : "border-border",
                      isToday && "border-primary",
                    )}
                  >
                    <span className={cn("text-xs font-medium tabular-nums", isToday && "text-primary")}>
                      {day.getDate()}
                    </span>
                    <div className="flex w-full flex-col gap-0.5">
                      {visible.map((item) =>
                        item.type === "event" ? (
                          <button
                            key={`${item.type}-${item.id}`}
                            type="button"
                            className="w-full text-left"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (item.event) setPreviewEvent(item.event);
                            }}
                          >
                            <Badge variant="default" className="w-full justify-start truncate">
                              {item.name}
                            </Badge>
                          </button>
                        ) : (
                          <Badge
                            key={`${item.type}-${item.id}`}
                            variant="secondary"
                            className="w-full justify-start truncate"
                          >
                            {item.name}
                          </Badge>
                        ),
                      )}
                      {overflow > 0 && (
                        <span className="text-[0.65rem] text-muted-foreground">+{overflow} more</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2 border-t pt-4">
              <h3 className="font-heading text-sm font-medium">
                {selectedDate.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </h3>
              {selectedItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
              ) : (
                <ul className="space-y-1.5">
                  {selectedItems.map((item) => {
                    const content = (
                      <>
                        <Badge variant={item.type === "event" ? "default" : "secondary"}>
                          {item.type === "event" ? "Event" : "Task"}
                        </Badge>
                        <span className="font-medium">{item.name}</span>
                        <span className="text-muted-foreground">{formatTime(item.time)}</span>
                        {item.eventName && (
                          <span className="text-muted-foreground">· {item.eventName}</span>
                        )}
                      </>
                    );
                    return (
                      <li key={`${item.type}-${item.id}`}>
                        {item.type === "event" ? (
                          <button
                            type="button"
                            className="flex w-full flex-wrap items-center gap-2 rounded-md p-1 text-left text-sm hover:bg-muted"
                            onClick={() => item.event && setPreviewEvent(item.event)}
                          >
                            {content}
                          </button>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2 p-1 text-sm">{content}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={previewEvent != null} onOpenChange={(open) => !open && setPreviewEvent(null)}>
        <DialogContent className="sm:max-w-lg">
          {previewEvent && (
            <>
              <DialogHeader>
                <DialogTitle>{previewEvent.name}</DialogTitle>
                {previewEvent.description && (
                  <DialogDescription>{previewEvent.description}</DialogDescription>
                )}
              </DialogHeader>

              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
                  <span>
                    <span className="font-medium text-foreground">When: </span>
                    {new Date(previewEvent.date).toLocaleString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                  {previewEvent.location && (
                    <span>
                      <span className="font-medium text-foreground">Location: </span>
                      {previewEvent.location.name}
                    </span>
                  )}
                  {formatBudget(previewEvent.totalBudget) && (
                    <span>
                      <span className="font-medium text-foreground">Budget: </span>
                      {formatBudget(previewEvent.totalBudget)}
                    </span>
                  )}
                </div>

                {previewEvent.eventManagers && previewEvent.eventManagers.length > 0 && (
                  <div>
                    <p className="mb-1 font-medium">Managers</p>
                    <div className="flex flex-wrap gap-1">
                      {previewEvent.eventManagers.map((em) => (
                        <Badge key={em.memberId} variant="secondary">
                          {em.member?.name ?? `Member #${em.memberId}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {previewEvent.tasks && previewEvent.tasks.length > 0 && (
                  <div>
                    <p className="mb-1 font-medium">Tasks</p>
                    <ul className="space-y-1">
                      {previewEvent.tasks.map((task) => (
                        <li key={task.taskId} className="flex items-center gap-2 text-muted-foreground">
                          <span className="text-foreground">{task.name}</span>
                          <span>· due {formatDateTime(task.deadline)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
