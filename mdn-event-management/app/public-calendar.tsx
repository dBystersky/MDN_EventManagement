"use client";

import { useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type PublicEvent = {
  eventId: number;
  name: string;
  description: string | null;
  date: string;
  location: string | null;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildMonthGrid(viewDate: Date): Date[] {
  const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const weeks = Math.ceil((startOffset + daysInMonth) / 7);
  return Array.from(
    { length: weeks * 7 },
    (_, i) => new Date(first.getFullYear(), first.getMonth(), 1 - startOffset + i),
  );
}

export function PublicCalendar({ events }: { events: PublicEvent[] }) {
  const [viewDate, setViewDate] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [selected, setSelected] = useState<PublicEvent | null>(null);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, PublicEvent[]>();
    for (const event of events) {
      const key = toDateKey(new Date(event.date));
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    return map;
  }, [events]);

  const days = useMemo(() => buildMonthGrid(viewDate), [viewDate]);
  const todayKey = toDateKey(new Date());

  function shift(delta: number) {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  }

  return (
    <>
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-heading text-lg font-medium">
              {viewDate.toLocaleDateString("en-AU", { month: "long", year: "numeric" })}
            </h3>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Previous month"
                onClick={() => shift(-1)}
              >
                <ChevronLeftIcon />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  setViewDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
                }
              >
                Today
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Next month"
                onClick={() => shift(1)}
              >
                <ChevronRightIcon />
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
              const items = eventsByDay.get(key) ?? [];
              const visible = items.slice(0, 2);
              const overflow = items.length - visible.length;

              return (
                <div
                  key={key}
                  className={cn(
                    "flex min-h-20 flex-col items-start gap-1 rounded-lg border p-1.5 sm:min-h-24",
                    inMonth ? "bg-card" : "bg-muted/40 text-muted-foreground",
                    key === todayKey && "border-primary",
                  )}
                >
                  <span
                    className={cn(
                      "text-xs font-medium tabular-nums",
                      key === todayKey && "text-primary",
                    )}
                  >
                    {day.getDate()}
                  </span>
                  {visible.map((event) => (
                    <button
                      key={event.eventId}
                      type="button"
                      className="w-full text-left"
                      onClick={() => setSelected(event)}
                    >
                      <Badge className="w-full justify-start truncate">{event.name}</Badge>
                    </button>
                  ))}
                  {overflow > 0 && (
                    <span className="text-[0.65rem] text-muted-foreground">+{overflow} more</span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={selected != null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          {selected && (
            <DialogHeader>
              <DialogTitle>{selected.name}</DialogTitle>
              <DialogDescription>
                {new Date(selected.date).toLocaleString("en-AU", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
                {selected.location && ` · ${selected.location}`}
              </DialogDescription>
              {selected.description && <p className="pt-2 text-sm">{selected.description}</p>}
            </DialogHeader>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
