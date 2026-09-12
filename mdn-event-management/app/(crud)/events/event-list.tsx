"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { formatEventDate, managerNamesFor, resourceNamesFor } from "./helpers";
import type { EventItem, Member, Resource } from "./types";

export function EventList({
  items,
  selectedId,
  members,
  resources,
  onSelect,
  onDelete,
}: {
  items: EventItem[];
  selectedId: number | null;
  members: Member[];
  resources: Resource[];
  onSelect: (event: EventItem) => void;
  onDelete: (eventId: number) => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Event list</CardTitle>
        <CardDescription>Select an event to edit it in the form.</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No events yet. Create one to see it listed here.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((ev) => {
              const selected = selectedId === ev.eventId;
              const managerNames = managerNamesFor(ev, members);
              const resourceNames = resourceNamesFor(ev, resources);
              return (
                <li
                  key={ev.eventId}
                  className={cn(
                    "flex cursor-pointer flex-col rounded-xl bg-muted p-3",
                    selected
                      ? "ring-2 ring-primary"
                      : "ring-1 ring-foreground/10 transition-colors hover:bg-accent/50 hover:ring-2 hover:ring-primary",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => onSelect(ev)}
                    >
                      <p className="font-medium">
                        #{ev.eventId} {ev.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatEventDate(ev.date)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Event Manager(s):{" "}
                        {managerNames.length > 0 ? managerNames.join(", ") : "None"}
                      </p>
                      {resourceNames.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Resources: {resourceNames.join(", ")}
                        </p>
                      )}
                      {ev.tasks && ev.tasks.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Tasks:{" "}
                          {ev.tasks
                            .map(
                              (task) =>
                                `${task.name}${task.budget ? ` ($${task.budget})` : ""}`,
                            )
                            .join(", ")}
                        </p>
                      )}
                    </button>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant="secondary">
                        {ev.location?.name ?? "No venue"}
                      </Badge>
                      <Badge variant="outline">${ev.totalBudget ?? "0"}</Badge>
                      <Button
                        type="button"
                        size="xs"
                        variant="destructive"
                        onClick={() => onDelete(ev.eventId)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
