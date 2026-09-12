"use client";

import { useEffect, useState, type ReactNode } from "react";
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
import { cn } from "@/lib/utils";
import { apiJson } from "../api";

type Member = { memberId: number; name: string; email: string };
type Resource = {
  resourceId: number;
  name: string;
  resourceTypeRel?: { name: string };
};
type Task = {
  taskId: number;
  name: string;
  eventId?: number | null;
  budget?: string | null;
  deadline?: string;
  taskManagers?: { memberId: number; member?: Member }[];
  bookable?: {
    resourceAllocations?: { resourceId: number; resource?: { name: string } }[];
  };
};
type Location = { locationId: number; name: string };
type EventItem = {
  eventId: number;
  name: string;
  description?: string | null;
  date: string;
  location?: { locationId: number; name: string };
  totalBudget?: string;
  tasks?: Task[];
  eventManagers?: { memberId: number; member?: Member }[];
  bookable?: {
    resourceAllocations?: { resourceId: number; resource?: { name: string } }[];
  };
};
/** Local-only rows until Create/Update persists them as Task records. */
type DraftSubtask = {
  key: string;
  name: string;
  assigneeId: string;
  deadline: string;
  resourceIds: string[];
};
type Option = { id: string; label: string };

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

function formatSubtaskDate(value: string) {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function names(values: Array<string | undefined | null>) {
  return values.filter((value): value is string => Boolean(value));
}

function resourceLabel(resource?: Resource | null) {
  if (!resource) return "Unknown";
  return resource.resourceTypeRel?.name
    ? `${resource.name} · ${resource.resourceTypeRel.name}`
    : resource.name;
}

/** Keep labels for IDs that are assigned but missing from the live catalog. */
function orphanOptions<T>(
  extras: T[] | undefined,
  isKnown: (item: T) => boolean,
  toOption: (item: T) => Option | null,
): Option[] {
  return (extras ?? []).flatMap((item) => {
    if (isKnown(item)) return [];
    const option = toOption(item);
    return option ? [option] : [];
  });
}

function Field({
  id,
  label,
  children,
}: {
  id?: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function OptionSelect({
  id,
  value,
  placeholder,
  options,
  onChange,
  className,
}: {
  id?: string;
  value: string;
  placeholder: string;
  options: Option[];
  onChange: (id: string) => void;
  className?: string;
}) {
  const labelFor = (optionId: string) =>
    options.find((option) => option.id === optionId)?.label ?? "";

  return (
    <Select
      value={value || null}
      items={options.map((option) => ({ value: option.id, label: option.label }))}
      itemToStringLabel={(item) => labelFor(String(item))}
      onValueChange={(item) => onChange(item == null ? "" : String(item))}
    >
      <SelectTrigger id={id} className={className ?? "w-full"}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false}>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RemovableChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  const text = label || "Unknown";
  return (
    <Badge variant="secondary" className="gap-1 pr-1">
      {text}
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        aria-label={`Remove ${text}`}
        onClick={onRemove}
      >
        <XIcon />
      </Button>
    </Badge>
  );
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
  options: Option[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  showSelected?: boolean;
}) {
  const [pendingId, setPendingId] = useState("");
  const available = options.filter((option) => !selectedIds.includes(option.id));
  const labelFor = (optionId: string) =>
    options.find((option) => option.id === optionId)?.label ?? "";

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <OptionSelect
          id={id}
          value={pendingId}
          placeholder={placeholder}
          options={available}
          onChange={setPendingId}
          className="min-w-0 flex-1"
        />
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
            <RemovableChip
              key={selectedId}
              label={labelFor(selectedId)}
              onRemove={() => onChange(selectedIds.filter((id) => id !== selectedId))}
            />
          ))}
        </div>
      )}
    </div>
  );
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
        const haystack = `${resource.name} ${resource.resourceTypeRel?.name ?? ""}`.toLowerCase();
        return haystack.includes(q);
      })
    : [];

  return (
    <div className="space-y-2">
      <Label
        htmlFor="subtask-resource-search"
        className="text-xs font-medium tracking-wide uppercase"
      >
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
              {resourceLabel(resource)}
            </Button>
          ))}
        </div>
      )}
      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map((selectedId) => {
            const resource = resources.find(
              (item) => String(item.resourceId) === selectedId,
            );
            return (
              <RemovableChip
                key={selectedId}
                label={resourceLabel(resource)}
                onRemove={() =>
                  onChange(selectedIds.filter((id) => id !== selectedId))
                }
              />
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No resources assigned yet — search above to add.
        </p>
      )}
    </div>
  );
}

function SubtaskRow({
  title,
  detail,
  onRemove,
}: {
  title: string;
  detail: string;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border bg-background p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        aria-label={`Remove ${title}`}
        onClick={onRemove}
      >
        <XIcon />
      </Button>
    </li>
  );
}

export default function EventsDemo() {
  const [items, setItems] = useState<EventItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [locationId, setLocationId] = useState("");
  const [managerIds, setManagerIds] = useState<string[]>([]);
  const [resourceIds, setResourceIds] = useState<string[]>([]);
  const [taskIds, setTaskIds] = useState<string[]>([]);
  const [draftSubtasks, setDraftSubtasks] = useState<DraftSubtask[]>([]);

  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [subtaskAssigneeId, setSubtaskAssigneeId] = useState("");
  const [subtaskDeadline, setSubtaskDeadline] = useState("");
  const [subtaskResourceIds, setSubtaskResourceIds] = useState<string[]>([]);

  const isEditing = selectedId != null;
  const selectedEvent = items.find((ev) => ev.eventId === selectedId);
  const memberOptions = members.map((member) => ({
    id: String(member.memberId),
    label: member.name,
  }));
  const locationOptions = locations.map((location) => ({
    id: String(location.locationId),
    label: location.name,
  }));

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

  function clearSubtaskComposer() {
    setDraftSubtasks([]);
    setSubtaskTitle("");
    setSubtaskAssigneeId("");
    setSubtaskDeadline("");
    setSubtaskResourceIds([]);
  }

  function resetForm() {
    setSelectedId(null);
    setName("");
    setDescription("");
    setDate("");
    setLocationId("");
    setManagerIds([]);
    setResourceIds([]);
    setTaskIds([]);
    clearSubtaskComposer();
  }

  function selectEvent(ev: EventItem) {
    setSelectedId(ev.eventId);
    setName(ev.name);
    setDescription(ev.description ?? "");
    setDate(toDatetimeLocal(ev.date));
    setLocationId(ev.location?.locationId != null ? String(ev.location.locationId) : "");
    setManagerIds((ev.eventManagers ?? []).map((em) => String(em.memberId)));
    setResourceIds(
      (ev.bookable?.resourceAllocations ?? []).map((allocation) =>
        String(allocation.resourceId),
      ),
    );
    setTaskIds((ev.tasks ?? []).map((task) => String(task.taskId)));
    clearSubtaskComposer();
    setError("");
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

  async function saveEvent() {
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
        managerIds: subtask.assigneeId ? [Number(subtask.assigneeId)] : [],
        resourceIds: subtask.resourceIds.map(Number),
      })),
    };

    if (isEditing) {
      selectEvent(await apiJson(`/api/events/${selectedId}`, "PATCH", payload));
    } else {
      await apiJson("/api/events", "POST", payload);
      resetForm();
    }
    await refresh();
  }

  async function deleteEvent(eventId: number) {
    await apiJson(`/api/events/${eventId}`, "DELETE");
    if (selectedId === eventId) resetForm();
    await refresh();
  }

  function managerNamesFor(ev: EventItem) {
    return names(
      (ev.eventManagers ?? []).map(
        (em) =>
          em.member?.name ??
          members.find((member) => member.memberId === em.memberId)?.name,
      ),
    );
  }

  function resourceNamesFor(ev: EventItem) {
    return names(
      (ev.bookable?.resourceAllocations ?? []).map(
        (allocation) =>
          allocation.resource?.name ??
          resources.find((resource) => resource.resourceId === allocation.resourceId)
            ?.name,
      ),
    );
  }

  function existingSubtaskDetails(taskId: string) {
    const fromEvent = selectedEvent?.tasks?.find(
      (task) => String(task.taskId) === taskId,
    );
    const fromCatalog = allTasks.find((task) => String(task.taskId) === taskId);
    const assignees = names(
      (fromEvent?.taskManagers ?? fromCatalog?.taskManagers ?? []).map(
        (tm) => tm.member?.name,
      ),
    );
    const assignedResources = names(
      (fromEvent?.bookable?.resourceAllocations ?? []).map(
        (allocation) => allocation.resource?.name,
      ),
    );
    const deadline = fromEvent?.deadline ?? fromCatalog?.deadline;

    return {
      name: fromEvent?.name ?? fromCatalog?.name ?? `Task #${taskId}`,
      detail: [
        assignees.join(", ") || "Unassigned",
        deadline ? `due ${formatSubtaskDate(deadline)}` : "",
        assignedResources.join(", "),
      ]
        .filter(Boolean)
        .join(" · "),
    };
  }

  const managerPickerOptions = [
    ...memberOptions,
    ...orphanOptions(
      selectedEvent?.eventManagers,
      (em) => members.some((member) => member.memberId === em.memberId),
      (em) =>
        em.member?.name ? { id: String(em.memberId), label: em.member.name } : null,
    ),
  ];
  const resourcePickerOptions = [
    ...resources.map((resource) => ({
      id: String(resource.resourceId),
      label: resource.name,
    })),
    ...orphanOptions(
      selectedEvent?.bookable?.resourceAllocations,
      (allocation) =>
        resources.some((resource) => resource.resourceId === allocation.resourceId),
      (allocation) =>
        allocation.resource?.name
          ? { id: String(allocation.resourceId), label: allocation.resource.name }
          : null,
    ),
  ];
  const taskPickerOptions = [
    ...allTasks.map((task) => ({
      id: String(task.taskId),
      label:
        task.eventId && task.eventId !== selectedId
          ? `${task.name} (event #${task.eventId})`
          : task.name,
    })),
    ...orphanOptions(
      selectedEvent?.tasks,
      (task) => allTasks.some((item) => item.taskId === task.taskId),
      (task) => ({ id: String(task.taskId), label: task.name }),
    ),
  ];

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
                  await saveEvent();
                } catch (err) {
                  setError(String(err));
                }
              }}
            >
              <CardContent className="space-y-4 pb-4">
                <Field id="event-name" label="Event name">
                  <Input
                    id="event-name"
                    placeholder="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </Field>
                <Field id="event-description" label="Description">
                  <Textarea
                    id="event-description"
                    placeholder="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="event-date" label="Date">
                    <Input
                      id="event-date"
                      type="datetime-local"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                    />
                  </Field>
                  <Field id="event-location" label="Location">
                    {/* Native required check; the visible control is a custom Select. */}
                    <input
                      id="event-location"
                      className="sr-only"
                      tabIndex={-1}
                      value={locationId}
                      onChange={() => undefined}
                      required
                      readOnly
                    />
                    <OptionSelect
                      value={locationId}
                      placeholder="Location..."
                      options={locationOptions}
                      onChange={setLocationId}
                    />
                  </Field>
                </div>
                <AssignmentPicker
                  key={`managers-${selectedId ?? "new"}`}
                  id="event-manager"
                  label="Event managers"
                  placeholder="Select a member..."
                  selectedIds={managerIds}
                  onChange={setManagerIds}
                  options={managerPickerOptions}
                />
                <AssignmentPicker
                  key={`resources-${selectedId ?? "new"}`}
                  id="event-resource"
                  label="Resources"
                  placeholder="Select a resource..."
                  selectedIds={resourceIds}
                  onChange={setResourceIds}
                  options={resourcePickerOptions}
                />

                <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-medium">Event subtasks</p>
                    <p className="text-xs text-muted-foreground">
                      Create assignments scoped to this event.
                    </p>
                  </div>

                  {/* Selected tasks are listed below, not as picker badges. */}
                  <AssignmentPicker
                    key={`tasks-${selectedId ?? "new"}`}
                    id="event-task"
                    label="Attach existing task"
                    placeholder="Select a task..."
                    showSelected={false}
                    selectedIds={taskIds}
                    onChange={setTaskIds}
                    options={taskPickerOptions}
                  />

                  <Field id="subtask-title" label="Subtask title">
                    <Input
                      id="subtask-title"
                      placeholder="e.g. Finish slides for the welcome talk"
                      value={subtaskTitle}
                      onChange={(e) => setSubtaskTitle(e.target.value)}
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="subtask-assignee" label="Assignee">
                      <OptionSelect
                        id="subtask-assignee"
                        value={subtaskAssigneeId}
                        placeholder="Select a member..."
                        options={memberOptions}
                        onChange={setSubtaskAssigneeId}
                      />
                    </Field>
                    <Field id="subtask-deadline" label="Due date">
                      <Input
                        id="subtask-deadline"
                        type="date"
                        value={subtaskDeadline}
                        onChange={(e) => setSubtaskDeadline(e.target.value)}
                      />
                    </Field>
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
                          <SubtaskRow
                            key={`existing-${taskId}`}
                            title={details.name}
                            detail={details.detail}
                            onRemove={() =>
                              setTaskIds((current) =>
                                current.filter((id) => id !== taskId),
                              )
                            }
                          />
                        );
                      })}
                      {draftSubtasks.map((subtask) => {
                        const assignee =
                          members.find(
                            (member) => String(member.memberId) === subtask.assigneeId,
                          )?.name ?? "Unassigned";
                        const resourceNames = names(
                          subtask.resourceIds.map(
                            (id) =>
                              resources.find(
                                (resource) => String(resource.resourceId) === id,
                              )?.name,
                          ),
                        );
                        return (
                          <SubtaskRow
                            key={subtask.key}
                            title={subtask.name}
                            detail={[
                              assignee,
                              `due ${formatSubtaskDate(subtask.deadline)}`,
                              resourceNames.join(", "),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                            onRemove={() =>
                              setDraftSubtasks((current) =>
                                current.filter((item) => item.key !== subtask.key),
                              )
                            }
                          />
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
                              onClick={async () => {
                                setError("");
                                try {
                                  await deleteEvent(ev.eventId);
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
