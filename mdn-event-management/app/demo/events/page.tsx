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

type Member = { memberId: number; name: string; email: string };
type EventTask = {
  taskId: number;
  name: string;
  budget: string | null;
  deadline?: string;
  taskManagers?: { memberId: number; member?: Member }[];
  bookable?: {
    resourceAllocations?: { resourceId: number; resource?: { name: string } }[];
  };
};
type Location = { locationId: number; name: string };
type Resource = {
  resourceId: number;
  name: string;
  resourceTypeRel?: { name: string };
};
type CatalogTask = {
  taskId: number;
  name: string;
  eventId: number | null;
  deadline?: string;
  taskManagers?: { memberId: number; member?: Member }[];
};
type DraftSubtask = {
  key: string;
  name: string;
  assigneeId: string;
  deadline: string;
  resourceIds: string[];
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
  showSelected = true,
}: {
  id: string;
  label: string;
  placeholder: string;
  options: { id: string; label: string }[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  showSelected?: boolean;
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
          <SelectContent align="start" alignItemWithTrigger={false}>
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
      {showSelected && selectedIds.length > 0 && (
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

function formatSubtaskDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ResourceSearch({
  resources,
  selectedIds,
  onChange,
}: {
  resources: Resource[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = q
    ? resources.filter((resource) => {
        if (selectedIds.includes(String(resource.resourceId))) return false;
        const typeName = resource.resourceTypeRel?.name ?? "";
        return (
          resource.name.toLowerCase().includes(q) ||
          typeName.toLowerCase().includes(q)
        );
      })
    : [];

  function labelFor(id: string) {
    const resource = resources.find((item) => String(item.resourceId) === id);
    if (!resource) return "Unknown";
    return resource.resourceTypeRel?.name
      ? `${resource.name} · ${resource.resourceTypeRel.name}`
      : resource.name;
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="subtask-resource-search" className="text-xs font-medium tracking-wide uppercase">
        Resources & equipment
      </Label>
      <p className="text-xs text-muted-foreground">
        Search to attach inventory for this subtask.
      </p>
      <Input
        id="subtask-resource-search"
        placeholder="Search by name or type..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {matches.length > 0 && (
        <div className="rounded-lg border bg-background p-1">
          {matches.slice(0, 6).map((resource) => (
            <Button
              key={resource.resourceId}
              type="button"
              variant="ghost"
              className="w-full justify-start"
              onClick={() => {
                onChange([...selectedIds, String(resource.resourceId)]);
                setQuery("");
              }}
            >
              {resource.name}
              {resource.resourceTypeRel?.name
                ? ` · ${resource.resourceTypeRel.name}`
                : ""}
            </Button>
          ))}
        </div>
      )}
      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map((selectedId) => (
            <Badge key={selectedId} variant="secondary" className="gap-1 pr-1">
              {labelFor(selectedId)}
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={`Remove ${labelFor(selectedId)}`}
                onClick={() =>
                  onChange(selectedIds.filter((id) => id !== selectedId))
                }
              >
                <XIcon />
              </Button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No resources assigned yet — search above to add.
        </p>
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
  const [allTasks, setAllTasks] = useState<CatalogTask[]>([]);
  const [taskIds, setTaskIds] = useState<string[]>([]);
  const [draftSubtasks, setDraftSubtasks] = useState<DraftSubtask[]>([]);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [subtaskAssigneeId, setSubtaskAssigneeId] = useState("");
  const [subtaskDeadline, setSubtaskDeadline] = useState("");
  const [subtaskResourceIds, setSubtaskResourceIds] = useState<string[]>([]);

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
    setTaskIds([]);
    setDraftSubtasks([]);
    setSubtaskTitle("");
    setSubtaskAssigneeId("");
    setSubtaskDeadline("");
    setSubtaskResourceIds([]);
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
    setTaskIds((ev.tasks ?? []).map((task) => String(task.taskId)));
    setDraftSubtasks([]);
    setSubtaskTitle("");
    setSubtaskAssigneeId("");
    setSubtaskDeadline("");
    setSubtaskResourceIds([]);
    setError("");
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

  function existingSubtaskDetails(taskId: string) {
    const fromEvent = items
      .find((ev) => ev.eventId === selectedId)
      ?.tasks?.find((task) => String(task.taskId) === taskId);
    const fromCatalog = allTasks.find((task) => String(task.taskId) === taskId);
    const assigneeNames = (fromEvent?.taskManagers ?? fromCatalog?.taskManagers ?? [])
      .map((tm) => tm.member?.name)
      .filter((name): name is string => Boolean(name));
    const assignedResources = (fromEvent?.bookable?.resourceAllocations ?? [])
      .map((allocation) => allocation.resource?.name)
      .filter((name): name is string => Boolean(name));

    return {
      name: fromEvent?.name ?? fromCatalog?.name ?? `Task #${taskId}`,
      deadline: fromEvent?.deadline ?? fromCatalog?.deadline,
      assignee: assigneeNames.length > 0 ? assigneeNames.join(", ") : "Unassigned",
      resources: assignedResources.join(", "),
    };
  }

  function addDraftSubtask() {
    const title = subtaskTitle.trim();
    if (!title || !subtaskDeadline) return;
    setDraftSubtasks((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        name: title,
        assigneeId: subtaskAssigneeId,
        deadline: subtaskDeadline,
        resourceIds: subtaskResourceIds,
      },
    ]);
    setSubtaskTitle("");
    setSubtaskAssigneeId("");
    setSubtaskDeadline("");
    setSubtaskResourceIds([]);
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
          <Card>
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
                    taskIds: taskIds.map(Number),
                    subtasks: draftSubtasks.map((subtask) => ({
                      name: subtask.name,
                      deadline: new Date(subtask.deadline).toISOString(),
                      managerIds: subtask.assigneeId
                        ? [Number(subtask.assigneeId)]
                        : [],
                      resourceIds: subtask.resourceIds.map(Number),
                    })),
                  };
                  if (isEditing) {
                    const saved = await apiJson(
                      `/api/events/${selectedId}`,
                      "PATCH",
                      payload,
                    );
                    selectEvent(saved);
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
                <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-medium">Event subtasks</p>
                    <p className="text-xs text-muted-foreground">
                      Create assignments scoped to this event.
                    </p>
                  </div>

                  <AssignmentPicker
                    key={`tasks-${selectedId ?? "new"}`}
                    id="event-task"
                    label="Attach existing task"
                    placeholder="Select a task..."
                    showSelected={false}
                    selectedIds={taskIds}
                    onChange={setTaskIds}
                    options={[
                      ...allTasks.map((task) => ({
                        id: String(task.taskId),
                        label:
                          task.eventId && task.eventId !== selectedId
                            ? `${task.name} (event #${task.eventId})`
                            : task.name,
                      })),
                      ...(items.find((ev) => ev.eventId === selectedId)?.tasks ?? [])
                        .filter(
                          (task) => !allTasks.some((t) => t.taskId === task.taskId),
                        )
                        .map((task) => ({
                          id: String(task.taskId),
                          label: task.name,
                        })),
                    ]}
                  />

                  <div className="space-y-2">
                    <Label htmlFor="subtask-title">Subtask title</Label>
                    <Input
                      id="subtask-title"
                      placeholder="e.g. Finish slides for the welcome talk"
                      value={subtaskTitle}
                      onChange={(e) => setSubtaskTitle(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="subtask-assignee">Assignee</Label>
                      <Select
                        value={subtaskAssigneeId || null}
                        items={members.map((member) => ({
                          value: String(member.memberId),
                          label: member.name,
                        }))}
                        itemToStringLabel={(value) =>
                          members.find((member) => String(member.memberId) === String(value))
                            ?.name ?? ""
                        }
                        onValueChange={(value) =>
                          setSubtaskAssigneeId(value == null ? "" : String(value))
                        }
                      >
                        <SelectTrigger id="subtask-assignee" className="w-full">
                          <SelectValue placeholder="Select a member..." />
                        </SelectTrigger>
                        <SelectContent align="start" alignItemWithTrigger={false}>
                          {members.map((member) => (
                            <SelectItem
                              key={member.memberId}
                              value={String(member.memberId)}
                            >
                              {member.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subtask-deadline">Due date</Label>
                      <Input
                        id="subtask-deadline"
                        type="date"
                        value={subtaskDeadline}
                        onChange={(e) => setSubtaskDeadline(e.target.value)}
                      />
                    </div>
                  </div>
                  <ResourceSearch
                    resources={resources}
                    selectedIds={subtaskResourceIds}
                    onChange={setSubtaskResourceIds}
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      disabled={!subtaskTitle.trim() || !subtaskDeadline}
                      onClick={addDraftSubtask}
                    >
                      Add subtask
                    </Button>
                  </div>

                  {taskIds.length === 0 && draftSubtasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No subtasks yet. Break this event into concrete assignments above.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {taskIds.map((taskId) => {
                        const details = existingSubtaskDetails(taskId);
                        return (
                          <li
                            key={`existing-${taskId}`}
                            className="flex items-start justify-between gap-3 rounded-lg border bg-background p-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{details.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {details.assignee}
                                {details.deadline
                                  ? ` · due ${formatSubtaskDate(details.deadline)}`
                                  : ""}
                                {details.resources
                                  ? ` · ${details.resources}`
                                  : ""}
                              </p>
                            </div>
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="ghost"
                              aria-label={`Remove ${details.name}`}
                              onClick={() =>
                                setTaskIds((current) =>
                                  current.filter((id) => id !== taskId),
                                )
                              }
                            >
                              <XIcon />
                            </Button>
                          </li>
                        );
                      })}
                      {draftSubtasks.map((subtask) => {
                        const assignee =
                          members.find(
                            (member) => String(member.memberId) === subtask.assigneeId,
                          )?.name ?? "Unassigned";
                        const resourceLabels = subtask.resourceIds
                          .map(
                            (id) =>
                              resources.find(
                                (resource) => String(resource.resourceId) === id,
                              )?.name,
                          )
                          .filter((label): label is string => Boolean(label));
                        return (
                          <li
                            key={subtask.key}
                            className="flex items-start justify-between gap-3 rounded-lg border bg-background p-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{subtask.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {assignee} · due {formatSubtaskDate(subtask.deadline)}
                                {resourceLabels.length > 0
                                  ? ` · ${resourceLabels.join(", ")}`
                                  : ""}
                              </p>
                            </div>
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="ghost"
                              aria-label={`Remove ${subtask.name}`}
                              onClick={() =>
                                setDraftSubtasks((current) =>
                                  current.filter((item) => item.key !== subtask.key),
                                )
                              }
                            >
                              <XIcon />
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
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

          <Card>
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
                            {ev.tasks && ev.tasks.length > 0 && (
                              <p className="text-xs text-muted-foreground">
                                Tasks:{" "}
                                {ev.tasks
                                  .map(
                                    (t) =>
                                      `${t.name}${t.budget ? ` ($${t.budget})` : ""}`,
                                  )
                                  .join(", ")}
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
