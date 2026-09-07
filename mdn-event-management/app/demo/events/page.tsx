"use client";

import { useEffect, useState } from "react";
import { CircleAlertIcon, XIcon } from "lucide-react";

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
type Location = { locationId: number; name: string };
type Member = { memberId: number; name: string; email: string };
type Resource = {
  resourceId: number;
  name: string;
  resourceTypeRel?: { name: string };
};
type EventItem = {
  eventId: number;
  name: string;
  description?: string | null;
  date: string;
  location?: { locationId: number; name: string };
  totalBudget?: string;
  tasks?: EventTask[];
  eventManagers?: { memberId: number; member?: Member }[];
  bookable?: {
    resourceAllocations?: { resourceId: number; resource?: { name: string } }[];
  };
};

function toDatetimeLocal(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatEventDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function AssignmentPicker({
  id,
  label,
  placeholder,
  options,
  selectedIds,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  options: { id: string; label: string }[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [pendingId, setPendingId] = useState("");
  const available = options.filter((option) => !selectedIds.includes(option.id));
  const selectItems = options.map((option) => ({
    value: option.id,
    label: option.label,
  }));

  function labelFor(id: string) {
    return options.find((option) => option.id === id)?.label ?? "";
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Select
          value={pendingId || null}
          items={selectItems}
          itemToStringLabel={(value) => labelFor(String(value))}
          onValueChange={(value) => setPendingId(value == null ? "" : String(value))}
        >
          <SelectTrigger id={id} className="min-w-0 flex-1">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent className="dark" align="start" alignItemWithTrigger={false}>
            {available.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="secondary"
          disabled={!pendingId}
          onClick={() => {
            if (!pendingId || selectedIds.includes(pendingId)) return;
            onChange([...selectedIds, pendingId]);
            setPendingId("");
          }}
        >
          Add
        </Button>
      </div>
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map((selectedId) => (
              <Badge key={selectedId} variant="secondary" className="gap-1 pr-1">
                {labelFor(selectedId) || "Unknown"}
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Remove ${labelFor(selectedId) || selectedId}`}
                  onClick={() => onChange(selectedIds.filter((id) => id !== selectedId))}
                >
                  <XIcon />
                </Button>
              </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EventsDemo() {
  const [items, setItems] = useState<EventItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [locationId, setLocationId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [managerIds, setManagerIds] = useState<string[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourceIds, setResourceIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [allTasks, setAllTasks] = useState<{ taskId: number; name: string; eventId: number | null }[]>([]);
  const [assignSelections, setAssignSelections] = useState<Record<number, string>>({});

  async function refresh() {
    const [events, locs, tasks, memberList, resourceList] = await Promise.all([
      apiJson("/api/events"),
      apiJson("/api/locations"),
      apiJson("/api/tasks"),
      apiJson("/api/members"),
      apiJson("/api/resources"),
    ]);
    setItems(events);
    setLocations(locs);
    setAllTasks(tasks);
    setMembers(memberList);
    setResources(resourceList);
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, []);

  function resetForm() {
    setSelectedId(null);
    setName("");
    setDescription("");
    setDate("");
    setLocationId("");
    setManagerIds([]);
    setResourceIds([]);
  }

  function selectEvent(ev: EventItem) {
    setSelectedId(ev.eventId);
    setName(ev.name);
    setDescription(ev.description ?? "");
    setDate(toDatetimeLocal(ev.date));
    setLocationId(ev.location?.locationId != null ? String(ev.location.locationId) : "");
    setManagerIds(
      (ev.eventManagers ?? []).map((em) => String(em.memberId)),
    );
    setResourceIds(
      (ev.bookable?.resourceAllocations ?? []).map((allocation) =>
        String(allocation.resourceId),
      ),
    );
    setError("");
  }

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

  const isEditing = selectedId != null;

  function managerNamesFor(ev?: EventItem) {
    return (ev?.eventManagers ?? [])
      .map(
        (em) =>
          em.member?.name ??
          members.find((member) => member.memberId === em.memberId)?.name,
      )
      .filter((name): name is string => Boolean(name));
  }

  function resourceNamesFor(ev?: EventItem) {
    return (ev?.bookable?.resourceAllocations ?? [])
      .map(
        (allocation) =>
          allocation.resource?.name ??
          resources.find((resource) => resource.resourceId === allocation.resourceId)
            ?.name,
      )
      .filter((name): name is string => Boolean(name));
  }

  return (
    <section className="relative left-1/2 w-screen -translate-x-1/2 -my-8 min-h-[calc(100vh-3.25rem)] bg-linear-to-b from-primary from-0% via-primary via-[45%] to-secondary px-6 py-8 md:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <h1 className="font-heading text-3xl font-medium tracking-tight text-primary-foreground">
            Events
          </h1>
        </header>

        {error && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>Could not save</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
          <Card className="dark">
            <CardHeader>
              <CardTitle>{isEditing ? "Update event" : "Event details"}</CardTitle>
              <CardDescription>
                {isEditing
                  ? "Change the selected event, then save."
                  : "Name the event, add a brief, then pick a time and venue."}
              </CardDescription>
            </CardHeader>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError("");
                try {
                  const payload = {
                    name,
                    description,
                    date: new Date(date).toISOString(),
                    locationId: Number(locationId),
                    managerIds: managerIds.map(Number),
                    resourceIds: resourceIds.map(Number),
                  };
                  if (isEditing) {
                    await apiJson(`/api/events/${selectedId}`, "PATCH", payload);
                  } else {
                    await apiJson("/api/events", "POST", payload);
                    resetForm();
                  }
                  await refresh();
                } catch (err) {
                  setError(String(err));
                }
              }}
            >
              <CardContent className="space-y-4 pb-4">
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
                      className="scheme-dark"
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
                      items={locations.map((l) => ({
                        value: String(l.locationId),
                        label: l.name,
                      }))}
                      itemToStringLabel={(value) =>
                        locations.find((l) => String(l.locationId) === String(value))
                          ?.name ?? ""
                      }
                      onValueChange={(value) =>
                        setLocationId(value == null ? "" : String(value))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Location..." />
                      </SelectTrigger>
                      <SelectContent
                        className="dark"
                        align="start"
                        alignItemWithTrigger={false}
                      >
                        {locations.map((l) => (
                          <SelectItem key={l.locationId} value={String(l.locationId)}>
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <AssignmentPicker
                  key={`managers-${selectedId ?? "new"}`}
                  id="event-manager"
                  label="Event managers"
                  placeholder="Select a member..."
                  selectedIds={managerIds}
                  onChange={setManagerIds}
                  options={[
                    ...members.map((m) => ({
                      id: String(m.memberId),
                      label: m.name,
                    })),
                    ...(items.find((ev) => ev.eventId === selectedId)?.eventManagers ?? [])
                      .filter(
                        (em) =>
                          em.member?.name &&
                          !members.some((m) => m.memberId === em.memberId),
                      )
                      .map((em) => ({
                        id: String(em.memberId),
                        label: em.member!.name,
                      })),
                  ]}
                />
                <AssignmentPicker
                  key={`resources-${selectedId ?? "new"}`}
                  id="event-resource"
                  label="Resources"
                  placeholder="Select a resource..."
                  selectedIds={resourceIds}
                  onChange={setResourceIds}
                  options={[
                    ...resources.map((r) => ({
                      id: String(r.resourceId),
                      label: r.name,
                    })),
                    ...(
                      items.find((ev) => ev.eventId === selectedId)?.bookable
                        ?.resourceAllocations ?? []
                    )
                      .filter(
                        (allocation) =>
                          allocation.resource?.name &&
                          !resources.some((r) => r.resourceId === allocation.resourceId),
                      )
                      .map((allocation) => ({
                        id: String(allocation.resourceId),
                        label: allocation.resource!.name,
                      })),
                  ]}
                />
              </CardContent>
              <CardFooter className="justify-end gap-2">
                {isEditing && (
                  <Button type="button" variant="ghost" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
                <Button type="submit">{isEditing ? "Update" : "Create"}</Button>
              </CardFooter>
            </form>
          </Card>

          <Card className="dark">
            <CardHeader>
              <CardTitle>Event list</CardTitle>
              <CardDescription>
                Select an event to edit it in the form.
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
                    const selected = selectedId === ev.eventId;
                    const managerNames = managerNamesFor(ev);
                    const resourceNames = resourceNamesFor(ev);
                    return (
                      <li
                        key={ev.eventId}
                        className={
                          selected
                            ? "flex cursor-pointer flex-col gap-3 rounded-xl bg-muted p-3 ring-2 ring-primary"
                            : "flex cursor-pointer flex-col gap-3 rounded-xl bg-muted p-3 ring-1 ring-foreground/10 transition-colors hover:bg-accent/50 hover:ring-2 hover:ring-primary"
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => selectEvent(ev)}
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
                          </button>
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
                                  if (selectedId === ev.eventId) resetForm();
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
                            <SelectContent
                              className="dark"
                              align="start"
                              alignItemWithTrigger={false}
                            >
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
