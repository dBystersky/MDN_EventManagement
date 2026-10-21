"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CircleAlertIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxList,
  ComboboxItem,
} from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TASK_STATUS_ITEMS, TaskStatusBadge } from "@/components/task-status-badge";
import { formatDateTime, toDatetimeLocal } from "@/lib/datetime";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  canCreateTask,
  canEditBudget,
  canModifyTask,
  canUpdateTaskDetails,
  fetchSession,
  type Actor,
  type EventAccessInfo,
  type TaskStatus,
} from "@/lib/permissions";
import { fuzzyMatches } from "@/lib/fuzzyFilter";
import { eventNameOf, managerNamesOf, searchTasks } from "@/lib/fuzzyTasks";
import { ApiError, apiJson } from "@/lib/api-json";
import { useFieldValidation } from "@/hooks/use-field-validation";
import { isInPast, validateTask } from "@/lib/validation";

type Member = { memberId: number; name: string; email: string };
type EventItem = EventAccessInfo & { eventId: number; name: string };
type Task = {
  taskId: number;
  name: string;
  description?: string | null;
  deadline: string;
  bookableId: number;
  eventId?: number | null;
  budget?: string | number | null;
  status: TaskStatus;
  taskManagers?: { memberId: number; member?: Member | null }[];
};

function formatBudget(value: string | number | null | undefined): string | null {
  if (value == null || value === "") return null;
  return `$${value}`;
}

export default function TasksDemo() {
  const [items, setItems] = useState<Task[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [budget, setBudget] = useState("");
  const [eventId, setEventId] = useState("");
  const [status, setStatus] = useState<TaskStatus>("backlog");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [managerIds, setManagerIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingManager, setPendingManager] = useState<{
    id: string;
    name: string;
    email: string;
    search: string;
  } | null>(null);
  const [actor, setActor] = useState<Actor>({ role: null, memberId: null });
  const validation = useFieldValidation({ name, deadline, budget }, validateTask);
  /** A task linked to by URL, waiting to be opened on the next render. */
  const [linkedTask, setLinkedTask] = useState<Task | null>(null);

  /** Fills the dialog with `task`; callers reset validation first if it may be stale. */
  function showEditForm(task: Task) {
    setSelectedId(task.taskId);
    setName(task.name);
    setDescription(task.description ?? "");
    setDeadline(toDatetimeLocal(task.deadline));
    setBudget(task.budget == null ? "" : String(task.budget));
    setEventId(task.eventId != null ? String(task.eventId) : "");
    setStatus(task.status);
    setManagerIds((task.taskManagers ?? []).map((tm) => String(tm.memberId)));
    setError("");
    setDialogOpen(true);
  }

  /** `openFromUrl`: on first load, `/tasks?task=ID` (linked from an event's subtasks) opens that task. */
  async function refresh(openFromUrl = false) {
    const [tasks, eventList, memberList, session]: [Task[], EventItem[], Member[], Actor | null] =
      await Promise.all([
        apiJson("/api/tasks"),
        apiJson("/api/events"),
        apiJson("/api/members"),
        fetchSession(),
      ]);
    setItems(tasks);
    setEvents(eventList);
    setMembers(memberList);
    const actor = session ?? { role: null, memberId: null };
    setActor(actor);
    if (!openFromUrl) return;

    const requested = new URLSearchParams(window.location.search).get("task");
    const task = requested ? tasks.find((t) => t.taskId === Number(requested)) : undefined;
    if (!task) return;
    window.history.replaceState(null, "", window.location.pathname);
    // `rightsFor` reads state that has not updated yet, so check against what was just fetched.
    const event = eventList.find((ev) => ev.eventId === task.eventId) ?? null;
    if (canUpdateTaskDetails(actor, { taskManagers: task.taskManagers ?? [] }, event)) {
      setLinkedTask(task);
    }
  }

  if (linkedTask) {
    setLinkedTask(null);
    showEditForm(linkedTask);
  }

  useEffect(() => {
    refresh(true).catch((e) => setError(String(e)));
  }, []);

  const eventNames = useMemo(
    () => new Map(events.map((event) => [event.eventId, event.name])),
    [events],
  );

  const eventsById = useMemo(
    () => new Map(events.map((event) => [event.eventId, event])),
    [events],
  );
  const eventOf = (task: Pick<Task, "eventId">) =>
    task.eventId != null ? (eventsById.get(task.eventId) ?? null) : null;

  /** What the signed-in person may do with one task (mirrors the API's checks). */
  function rightsFor(task: Task) {
    const event = eventOf(task);
    return {
      edit: canUpdateTaskDetails(actor, { taskManagers: task.taskManagers ?? [] }, event),
      full: canModifyTask(actor, event),
    };
  }

  const matches = useMemo(
    () =>
      searchTasks(query, items, eventNames).filter(
        ({ task }) => statusFilter === "all" || task.status === statusFilter,
      ),
    [query, items, eventNames, statusFilter],
  );

  async function changeStatus(task: Task, next: TaskStatus) {
    setError("");
    setPending(true);
    try {
      await apiJson(`/api/tasks/${task.taskId}`, "PATCH", { status: next });
      await refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setPending(false);
    }
  }

  function resetForm() {
    setSelectedId(null);
    setName("");
    setDescription("");
    setDeadline("");
    setBudget("");
    setEventId("");
    setStatus("backlog");
    setManagerIds([]);
    setPendingManager(null);
    validation.reset();
  }

  function openCreate() {
    if (!canCreate) return;
    resetForm();
    setError("");
    setDialogOpen(true);
  }

  function openEdit(task: Task) {
    if (!rightsFor(task).edit) return;
    validation.reset();
    showEditForm(task);
  }

  /** Closing by any route — Cancel, Escape, backdrop, X — clears the form so the
   *  next open never inherits the last edit. */
  function handleOpenChange(open: boolean) {
    setDialogOpen(open);
    if (!open) {
      resetForm();
      setError("");
    }
  }

  // Events the person may put a task in: Members only their own, Managers the
  // ones they manage (or none at all).
  const eventOptions = useMemo(
    () =>
      events
        .filter((event) => canCreateTask(actor, event) || event.eventId === Number(eventId))
        .map((event) => ({
          id: String(event.eventId),
          name: event.name,
          search: event.name,
        })),
    [events, actor, eventId],
  );

  const managerOptions = useMemo(
    () =>
      members.map((member) => ({
        id: String(member.memberId),
        name: member.name,
        email: member.email,
        search: `${member.name} ${member.email}`,
      })),
    [members],
  );

  const availableManagers = useMemo(
    () => managerOptions.filter((option) => !managerIds.includes(option.id)),
    [managerOptions, managerIds],
  );

  const selectedEvent = eventOptions.find((option) => option.id === eventId) ?? null;

  const isEditing = selectedId != null;
  const selectedTask = isEditing ? (items.find((t) => t.taskId === selectedId) ?? null) : null;
  // Creating: Executives and Managers anywhere they manage; Members need an event.
  const canCreate =
    canCreateTask(actor, null) || events.some((event) => canCreateTask(actor, event));
  const canSubmit = isEditing ? !!selectedTask && rightsFor(selectedTask).edit : canCreate;
  // Moving a task between events and assigning people need full rights over it;
  // a Member creating one is placing it in their own event but cannot assign.
  const canAssign = isEditing
    ? !!selectedTask && rightsFor(selectedTask).full
    : canCreateTask(actor, null) || canModifyTask(actor, eventsById.get(Number(eventId)) ?? null);
  const canMoveEvent = isEditing ? canAssign : canCreate;
  const canSetBudget = canEditBudget(actor);
  // The Actions column only appears when at least one shown row can be deleted.
  const anyDeletable = matches.some(({ task }) => rightsFor(task).full);

  function managerLabel(id: string) {
    return managerOptions.find((option) => option.id === id)?.name ?? "Unknown";
  }

  return (
    <section>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Tasks</h1>
        </header>

        {/* Suppressed while the dialog is open — its own alert carries the
            message, and this one would sit behind the backdrop. */}
        {error && !dialogOpen && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Assignments</CardTitle>
            <CardDescription>
              Each task can belong to an event, carry a budget, and have members assigned to it.
              Select a row to edit it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="task-search"
                  type="search"
                  placeholder="Search by name, event, or assignee..."
                  aria-label="Search tasks"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-8"
                />
              </div>
              {query && (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                >
                  <XIcon />
                </Button>
              )}
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {query ? `${matches.length} of ${items.length}` : `${items.length} total`}
              </span>
              <Select
                items={[{ value: "all", label: "All statuses" }, ...TASK_STATUS_ITEMS]}
                value={statusFilter}
                onValueChange={(value) => setStatusFilter((value ?? "all") as TaskStatus | "all")}
              >
                <SelectTrigger aria-label="Filter by status" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {TASK_STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {TASK_STATUS_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {canCreate && (
                <Button type="button" size="sm" onClick={openCreate}>
                  <PlusIcon />
                  New task
                </Button>
              )}
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tasks yet. Create one to see it listed here.
              </p>
            ) : matches.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  No tasks match &ldquo;{query}&rdquo;.
                </p>
                <Button type="button" size="sm" variant="secondary" onClick={() => setQuery("")}>
                  Clear search
                </Button>
              </div>
            ) : (
              <div className="min-w-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Deadline</TableHead>
                      <TableHead>Budget</TableHead>
                      <TableHead>Managers</TableHead>
                      {anyDeletable && <TableHead className="w-0 text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matches.map(({ task, nameMatch }) => {
                      const eventName = eventNameOf(task, eventNames);
                      const managerNames = managerNamesOf(task);
                      const budgetLabel = formatBudget(task.budget);
                      const rights = rightsFor(task);
                      const label = nameMatch
                        ? nameMatch.highlight((match, i) => (
                            <mark key={i} className="rounded-xs bg-primary/20 text-foreground">
                              {match}
                            </mark>
                          ))
                        : task.name;
                      return (
                        <TableRow key={task.taskId}>
                          <TableCell className="text-xs text-muted-foreground tabular-nums">
                            {task.taskId}
                          </TableCell>
                          <TableCell>
                            {rights.edit ? (
                              <button
                                type="button"
                                className="w-full text-left font-medium hover:underline"
                                onClick={() => openEdit(task)}
                              >
                                {label}
                              </button>
                            ) : (
                              <span className="font-medium">{label}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {eventName || <span className="text-muted-foreground">Unassigned</span>}
                          </TableCell>
                          <TableCell>
                            {!rights.edit ? (
                              <TaskStatusBadge status={task.status} />
                            ) : (
                              <Select
                                items={TASK_STATUS_ITEMS}
                                value={task.status}
                                onValueChange={(value) => value && changeStatus(task, value)}
                                disabled={pending}
                              >
                                <SelectTrigger
                                  size="sm"
                                  aria-label={`Status of ${task.name}`}
                                  className="w-36"
                                >
                                  <SelectValue>
                                    {(value: TaskStatus) => <TaskStatusBadge status={value} />}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {TASK_STATUSES.map((value) => (
                                    <SelectItem key={value} value={value}>
                                      <TaskStatusBadge status={value} />
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {formatDateTime(task.deadline)}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {budgetLabel ?? <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-sm">
                            {managerNames || (
                              <span className="text-muted-foreground">Unassigned</span>
                            )}
                          </TableCell>
                          {anyDeletable && (
                            <TableCell className="text-right">
                              {rights.full && (
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="destructive"
                                  disabled={pending}
                                  onClick={async () => {
                                    setError("");
                                    setPending(true);
                                    try {
                                      await apiJson(`/api/tasks/${task.taskId}`, "DELETE");
                                      if (selectedId === task.taskId) resetForm();
                                      await refresh();
                                    } catch (err) {
                                      setError(String(err));
                                    } finally {
                                      setPending(false);
                                    }
                                  }}
                                >
                                  Delete
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <form
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              if (!validation.checkBeforeSubmit(e.currentTarget)) return;
              const parsedBudget = budget.trim() === "" ? null : Number(budget);
              setPending(true);
              try {
                // Send only what this person may change; the API refuses the rest.
                const payload = {
                  name: name.trim(),
                  description: description.trim(),
                  deadline: new Date(deadline).toISOString(),
                  status,
                  ...(canSetBudget ? { budget: parsedBudget } : {}),
                  // A Member creating a task still has to place it in their event.
                  ...(canMoveEvent ? { eventId: eventId ? Number(eventId) : null } : {}),
                  ...(canAssign ? { managerIds: managerIds.map(Number) } : {}),
                };
                if (isEditing) {
                  await apiJson(`/api/tasks/${selectedId}`, "PATCH", payload);
                } else {
                  await apiJson("/api/tasks", "POST", payload);
                }
                handleOpenChange(false);
                await refresh();
              } catch (err) {
                if (err instanceof ApiError && validation.setServerErrors(err.fieldErrors)) {
                  return;
                }
                setError(String(err));
              } finally {
                setPending(false);
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>{isEditing ? "Update task" : "New task"}</DialogTitle>
              <DialogDescription>
                {isEditing
                  ? "Change the selected task, then save."
                  : "Name the task, set a deadline, and optionally attach an event, budget, and managers."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {error && (
                <Alert variant="destructive">
                  <CircleAlertIcon />
                  <AlertTitle>Could not save</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="task-name">Task name</Label>
                <Input
                  id="task-name"
                  placeholder="e.g. Finish slides for the welcome talk"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!canSubmit}
                  required
                  {...validation.fieldProps("name", "task-name")}
                />
                <FieldError id="task-name-error">{validation.errorFor("name")}</FieldError>
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-description">Description</Label>
                <Textarea
                  id="task-description"
                  placeholder="Optional details"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={!canSubmit}
                />
              </div>

              <div className={canSetBudget ? "grid gap-4 sm:grid-cols-2" : "grid gap-4"}>
                <div className="space-y-2">
                  <Label htmlFor="task-deadline">Deadline</Label>
                  <Input
                    id="task-deadline"
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => {
                      setDeadline(e.target.value);
                      validation.touch("deadline");
                    }}
                    disabled={!canSubmit}
                    required
                    {...validation.fieldProps("deadline", "task-deadline")}
                  />
                  <FieldError id="task-deadline-error">
                    {validation.errorFor("deadline")}
                  </FieldError>
                  {!validation.errorFor("deadline") && isInPast(deadline) && (
                    <FieldDescription>This is in the past.</FieldDescription>
                  )}
                </div>
                {canSetBudget && (
                  <div className="space-y-2">
                    <Label htmlFor="task-budget">Budget</Label>
                    <Input
                      id="task-budget"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Optional"
                      value={budget}
                      onChange={(e) => {
                        setBudget(e.target.value);
                        validation.touch("budget");
                      }}
                      disabled={!canSubmit}
                      {...validation.fieldProps("budget", "task-budget")}
                    />
                    <FieldError id="task-budget-error">{validation.errorFor("budget")}</FieldError>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-status">Status</Label>
                <Select
                  items={TASK_STATUS_ITEMS}
                  value={status}
                  onValueChange={(value) => setStatus((value ?? "backlog") as TaskStatus)}
                  disabled={!canSubmit}
                >
                  <SelectTrigger id="task-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {TASK_STATUS_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor={canMoveEvent ? "task-event" : undefined}>Event</Label>
                {!canMoveEvent ? (
                  <p className="text-sm">
                    {eventsById.get(Number(eventId))?.name ?? (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </p>
                ) : (
                  <Combobox
                    items={eventOptions}
                    value={selectedEvent}
                    onValueChange={(option) => setEventId(option ? option.id : "")}
                    itemToStringLabel={(option) => option.name}
                    isItemEqualToValue={(a, b) => a?.id === b?.id}
                    filter={(item, query) => fuzzyMatches(item.search, query)}
                  >
                    <ComboboxInput
                      id="task-event"
                      placeholder="Search events..."
                      disabled={!canSubmit}
                      showClear
                      className="w-full"
                    />
                    <ComboboxContent>
                      <ComboboxEmpty>No events match.</ComboboxEmpty>
                      <ComboboxList>
                        <ComboboxCollection>
                          {(option: (typeof eventOptions)[number]) => (
                            <ComboboxItem key={option.id} value={option}>
                              <span className="truncate">{option.name}</span>
                            </ComboboxItem>
                          )}
                        </ComboboxCollection>
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                )}
                {canMoveEvent && events.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No events exist yet.{" "}
                    <Link href="/events" className="text-primary underline underline-offset-4">
                      Create an event
                    </Link>{" "}
                    first, or leave this unassigned.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor={canAssign ? "task-manager" : undefined}>Managers</Label>
                {canAssign && (
                  <Combobox
                    key={managerIds.join("-") || "none"}
                    items={availableManagers}
                    value={pendingManager}
                    onValueChange={(option) => {
                      if (!option) {
                        setPendingManager(null);
                        return;
                      }
                      if (!managerIds.includes(option.id)) {
                        setManagerIds([...managerIds, option.id]);
                      }
                      setPendingManager(null);
                    }}
                    itemToStringLabel={(option) => option.name}
                    isItemEqualToValue={(a, b) => a?.id === b?.id}
                    filter={(item, query) => fuzzyMatches(item.search, query)}
                  >
                    <ComboboxInput
                      id="task-manager"
                      placeholder="Search members..."
                      disabled={!canSubmit || availableManagers.length === 0}
                      className="w-full"
                    />
                    <ComboboxContent>
                      <ComboboxEmpty>No members match.</ComboboxEmpty>
                      <ComboboxList>
                        <ComboboxCollection>
                          {(option: (typeof managerOptions)[number]) => (
                            <ComboboxItem key={option.id} value={option}>
                              <span className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate">{option.name}</span>
                                <span className="truncate text-xs text-muted-foreground">
                                  {option.email}
                                </span>
                              </span>
                            </ComboboxItem>
                          )}
                        </ComboboxCollection>
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                )}
                {canAssign && members.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No members exist yet. Sign up accounts first to assign managers.
                  </p>
                ) : managerIds.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {managerIds.map((id) => (
                      <Badge
                        key={id}
                        variant="secondary"
                        className={canAssign ? "gap-1 pr-1" : undefined}
                      >
                        {managerLabel(id)}
                        {canAssign && (
                          <Button
                            type="button"
                            size="icon-xs"
                            variant="ghost"
                            aria-label={`Remove ${managerLabel(id)}`}
                            disabled={!canSubmit}
                            onClick={() =>
                              setManagerIds(managerIds.filter((managerId) => managerId !== id))
                            }
                          >
                            <XIcon />
                          </Button>
                        )}
                      </Badge>
                    ))}
                  </div>
                ) : canAssign ? (
                  <p className="text-xs text-muted-foreground">
                    Optional. Search a member to add them.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Unassigned</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !canSubmit}>
                {isEditing ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
