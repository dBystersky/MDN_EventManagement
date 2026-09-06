"use client";

import { useEffect, useState } from "react";
import { CircleAlertIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiJson } from "../api";

type EventTask = { taskId: number; name: string; budget: string | null };
type EventItem = {
  eventId: number;
  name: string;
  date: string;
  location?: { name: string };
  totalBudget?: string;
  tasks?: EventTask[];
};
type Location = { locationId: number; name: string };

export default function EventsDemo() {
  const [items, setItems] = useState<EventItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [locationId, setLocationId] = useState("");
  const [editId, setEditId] = useState("");
  const [error, setError] = useState("");
  const [allTasks, setAllTasks] = useState<{ taskId: number; name: string; eventId: number | null }[]>([]);
  const [assignSelections, setAssignSelections] = useState<Record<number, string>>({});

  async function refresh() {
    const [events, locs, tasks] = await Promise.all([
      apiJson("/api/events"),
      apiJson("/api/locations"),
      apiJson("/api/tasks"),
    ]);
    setItems(events);
    setLocations(locs);
    setAllTasks(tasks);
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, []);

  async function assignTask(eventId: number) {
    const taskId = assignSelections[eventId];
    if (!taskId) return;
    setError("");
    try {
      await apiJson(`/api/tasks/${taskId}`, "PATCH", { eventId });
      setAssignSelections((prev) => ({ ...prev, [eventId]: "" }));
      await refresh();
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <section className="relative left-1/2 w-screen -translate-x-1/2 -my-8 min-h-[calc(100vh-3.25rem)] bg-linear-to-b from-primary from-0% via-primary via-[45%] to-secondary px-6 py-8 md:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-primary-foreground/75 uppercase">
            Programme
          </p>
          <h1 className="font-heading text-3xl font-medium tracking-tight text-primary-foreground">
            Create event
          </h1>
          <p className="text-sm text-primary-foreground/80">
            Create a location first if the dropdown is empty.
          </p>
        </header>

        {error && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>Could not save</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Event details</CardTitle>
                <CardDescription>
                  Name the event, add a brief, then pick a time and venue.
                </CardDescription>
              </CardHeader>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setError("");
                  try {
                    await apiJson("/api/events", "POST", {
                      name,
                      description,
                      date: new Date(date).toISOString(),
                      locationId: Number(locationId),
                    });
                    setName("");
                    setDescription("");
                    await refresh();
                  } catch (err) {
                    setError(String(err));
                  }
                }}
              >
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="event-name">Event name</Label>
                    <Input
                      id="event-name"
                      placeholder="Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="event-description">Description</Label>
                    <Textarea
                      id="event-description"
                      placeholder="Description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="event-date">Date</Label>
                      <Input
                        id="event-date"
                        type="datetime-local"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="event-location">Location</Label>
                      <input
                        id="event-location"
                        className="sr-only"
                        tabIndex={-1}
                        value={locationId}
                        onChange={() => undefined}
                        required
                        readOnly
                      />
                      <Select
                        value={locationId || null}
                        onValueChange={(value) =>
                          setLocationId(value == null ? "" : String(value))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Location..." />
                        </SelectTrigger>
                        <SelectContent align="start" alignItemWithTrigger={false}>
                          {locations.map((l) => (
                            <SelectItem key={l.locationId} value={String(l.locationId)}>
                              {l.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="justify-end">
                  <Button type="submit">Create</Button>
                </CardFooter>
              </form>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Update event</CardTitle>
                <CardDescription>
                  Enter an event id and a new name, then save.
                </CardDescription>
              </CardHeader>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setError("");
                  try {
                    await apiJson(`/api/events/${editId}`, "PATCH", { name });
                    await refresh();
                  } catch (err) {
                    setError(String(err));
                  }
                }}
              >
                <CardContent className="grid gap-4 sm:grid-cols-[6rem_minmax(0,1fr)]">
                  <div className="space-y-2">
                    <Label htmlFor="event-edit-id">id</Label>
                    <Input
                      id="event-edit-id"
                      placeholder="id"
                      value={editId}
                      onChange={(e) => setEditId(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="event-edit-name">New name</Label>
                    <Input
                      id="event-edit-name"
                      placeholder="New name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                </CardContent>
                <CardFooter className="justify-end">
                  <Button type="submit" variant="secondary">
                    Update
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Event list</CardTitle>
              <CardDescription>
                Scheduled events, budgets, and assigned tasks.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No events yet. Create one to see it listed here.
                </p>
              ) : (
                <ul className="space-y-3">
                  {items.map((ev) => {
                    const selected = editId === String(ev.eventId);
                    return (
                      <li
                        key={ev.eventId}
                        className={
                          selected
                            ? "flex flex-col gap-3 rounded-xl bg-card p-3 ring-2 ring-primary"
                            : "flex flex-col gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10"
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <p className="font-medium">
                              #{ev.eventId} {ev.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              ({ev.location?.name}) · budget ${ev.totalBudget ?? "0"}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <Badge variant="secondary">{ev.location?.name ?? "No venue"}</Badge>
                            <Badge variant="outline">${ev.totalBudget ?? "0"}</Badge>
                            <Button
                              type="button"
                              size="xs"
                              variant="destructive"
                              onClick={async () => {
                                setError("");
                                try {
                                  await apiJson(`/api/events/${ev.eventId}`, "DELETE");
                                  await refresh();
                                } catch (err) {
                                  setError(String(err));
                                }
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>

                        {ev.tasks && ev.tasks.length > 0 && (
                          <ul className="space-y-1 text-xs text-muted-foreground">
                            {ev.tasks.map((t) => (
                              <li key={t.taskId}>
                                #{t.taskId} {t.name}
                                {t.budget ? ` · $${t.budget}` : ""}
                              </li>
                            ))}
                          </ul>
                        )}

                        <div className="flex items-center gap-2">
                          <Select
                            value={assignSelections[ev.eventId] || null}
                            onValueChange={(value) =>
                              setAssignSelections((prev) => ({
                                ...prev,
                                [ev.eventId]: value == null ? "" : String(value),
                              }))
                            }
                          >
                            <SelectTrigger className="min-w-0 flex-1">
                              <SelectValue placeholder="Assign existing task..." />
                            </SelectTrigger>
                            <SelectContent align="start" alignItemWithTrigger={false}>
                              {allTasks
                                .filter((t) => t.eventId !== ev.eventId)
                                .map((t) => (
                                  <SelectItem key={t.taskId} value={String(t.taskId)}>
                                    #{t.taskId} {t.name}
                                    {t.eventId ? ` (event #${t.eventId})` : " (unassigned)"}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={!assignSelections[ev.eventId]}
                            onClick={() => assignTask(ev.eventId)}
                          >
                            Assign
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
