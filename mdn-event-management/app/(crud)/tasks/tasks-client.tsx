"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CircleAlertIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime, toDatetimeLocal } from "@/lib/datetime";
import { fetchSessionRole, taskPermissions, type Capabilities } from "@/lib/permissions";
import { fuzzyMatches } from "@/lib/fuzzyFilter";
import { eventNameOf, managerNamesOf, searchTasks } from "@/lib/fuzzyTasks";
import { apiJson } from "@/lib/api-json";

type Member = { memberId: number; name: string; email: string };
type EventItem = { eventId: number; name: string };
type Task = {
  taskId: number;
  name: string;
  description?: string | null;
  deadline: string;
  bookableId: number;
  eventId?: number | null;
  budget?: string | number | null;
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
  const [can, setCan] = useState<Capabilities>(() => taskPermissions(null));

  async function refresh() {
    const [tasks, eventList, memberList, role] = await Promise.all([
      apiJson("/api/tasks"),
      apiJson("/api/events"),
      apiJson("/api/members"),
      fetchSessionRole(),
    ]);
    setItems(tasks);
    setEvents(eventList);
    setMembers(memberList);
    setCan(taskPermissions(role));
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, []);

  const eventNames = useMemo(
    () => new Map(events.map((event) => [event.eventId, event.name])),
    [events],
  );

  const matches = useMemo(
    () => searchTasks(query, items, eventNames),
    [query, items, eventNames],
  );

  function resetForm() {
    setSelectedId(null);
    setName("");
    setDescription("");
    setDeadline("");
    setBudget("");
    setEventId("");
    setManagerIds([]);
    setPendingManager(null);
  }

  function openCreate() {
    if (!can.create) return;
    resetForm();
    setError("");
    setDialogOpen(true);
  }

  function openEdit(task: Task) {
    if (!can.edit) return;
    setSelectedId(task.taskId);
    setName(task.name);
    setDescription(task.description ?? "");
    setDeadline(toDatetimeLocal(task.deadline));
    setBudget(task.budget == null ? "" : String(task.budget));
    setEventId(task.eventId != null ? String(task.eventId) : "");
    setManagerIds((task.taskManagers ?? []).map((tm) => String(tm.memberId)));
    setError("");
    setDialogOpen(true);
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

  const eventOptions = useMemo(
    () =>
      events.map((event) => ({
        id: String(event.eventId),
        name: event.name,
        search: event.name,
      })),
    [events],
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
  const canSubmit = isEditing ? can.edit : can.create;

  function managerLabel(id: string) {
    return managerOptions.find((option) => option.id === id)?.name ?? "Unknown";
  }

  return (
    <section className="relative left-1/2 w-screen -translate-x-1/2 -my-8 min-h-[calc(100vh-3.25rem)] bg-linear-to-b from-primary from-0% via-primary via-[45%] to-secondary px-6 py-8 md:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <h1 className="font-heading text-3xl font-medium tracking-tight text-primary-foreground">
            Tasks
          </h1>
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
              Each task can belong to an event, carry a budget, and have members assigned to
              it. Select a row to edit it.
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
              <Button type="button" size="sm" disabled={!can.create} onClick={openCreate}>
                <PlusIcon />
                New task
              </Button>
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Deadline</TableHead>
                      <TableHead>Budget</TableHead>
                      <TableHead>Managers</TableHead>
                      <TableHead className="w-0 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matches.map(({ task, nameMatch }) => {
                      const eventName = eventNameOf(task, eventNames);
                      const managerNames = managerNamesOf(task);
                      const budgetLabel = formatBudget(task.budget);
                      return (
                        <TableRow key={task.taskId}>
                          <TableCell className="text-xs text-muted-foreground tabular-nums">
                            {task.taskId}
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              className="w-full text-left font-medium hover:underline disabled:cursor-not-allowed disabled:no-underline"
                              disabled={!can.edit}
                              onClick={() => openEdit(task)}
                            >
                              {nameMatch
                                ? nameMatch.highlight((match, i) => (
                                    <mark
                                      key={i}
                                      className="rounded-xs bg-primary/20 text-foreground"
                                    >
                                      {match}
                                    </mark>
                                  ))
                                : task.name}
                            </button>
                          </TableCell>
                          <TableCell className="text-sm">
                            {eventName || (
                              <span className="text-muted-foreground">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {formatDateTime(task.deadline)}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {budgetLabel ?? (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {managerNames || (
                              <span className="text-muted-foreground">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="xs"
                              variant="destructive"
                              disabled={pending || !can.delete}
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
                          </TableCell>
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
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              if (!name.trim()) {
                setError("Name a task before saving.");
                return;
              }
              if (!deadline) {
                setError("Pick a deadline before saving.");
                return;
              }
              const parsedBudget = budget.trim() === "" ? null : Number(budget);
              if (parsedBudget != null && (!Number.isFinite(parsedBudget) || parsedBudget < 0)) {
                setError("Budget must be a number that is not negative.");
                return;
              }
              setPending(true);
              try {
                const payload = {
                  name: name.trim(),
                  description: description.trim(),
                  deadline: new Date(deadline).toISOString(),
                  budget: parsedBudget,
                  eventId: eventId ? Number(eventId) : null,
                  managerIds: managerIds.map(Number),
                };
                if (isEditing) {
                  await apiJson(`/api/tasks/${selectedId}`, "PATCH", payload);
                } else {
                  await apiJson("/api/tasks", "POST", payload);
                }
                handleOpenChange(false);
                await refresh();
              } catch (err) {
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
                />
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

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="task-deadline">Deadline</Label>
                  <Input
                    id="task-deadline"
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    disabled={!canSubmit}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-budget">Budget</Label>
                  <Input
                    id="task-budget"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Optional"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    disabled={!canSubmit}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-event">Event</Label>
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
                {events.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No events exist yet.{" "}
                    <Link
                      href="/events"
                      className="text-primary underline underline-offset-4"
                    >
                      Create an event
                    </Link>{" "}
                    first, or leave this unassigned.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-manager">Managers</Label>
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
                {members.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No members exist yet. Sign up accounts first to assign managers.
                  </p>
                ) : managerIds.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {managerIds.map((id) => (
                      <Badge key={id} variant="secondary" className="gap-1 pr-1">
                        {managerLabel(id)}
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
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Optional. Search a member to add them.
                  </p>
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
