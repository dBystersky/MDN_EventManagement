"use client";

import { useEffect, useMemo, useState } from "react";
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
import { formatDateTime, formatDuration, toDatetimeLocal } from "@/lib/datetime";
import { allocationPermissions, fetchSessionRole, type Capabilities } from "@/lib/permissions";
import { resourceTypeStyle } from "@/lib/resourceTypeColor";
import { fuzzyMatches } from "@/lib/fuzzyFilter";
import { searchAllocations } from "@/lib/fuzzyAllocations";
import { apiJson } from "../api";

type Allocation = {
  allocationId: number;
  bookableId: number;
  resourceId: number;
  startTime: string;
  endTime: string;
  resource?: {
    resourceId: number;
    name: string;
    resourceTypeRel?: { typeId: number; name: string };
  };
  bookable?: { bookableId: number; bookableType: string };
};
type Resource = {
  resourceId: number;
  name: string;
  resourceTypeRel?: { typeId: number; name: string };
};
type Task = { taskId: number; name: string; bookableId: number };
type EventItem = { eventId: number; name: string; bookableId: number };
type Bookable = { id: number; name: string; label: string; kind: string };

export default function AllocationsDemo() {
  const [items, setItems] = useState<Allocation[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [bookables, setBookables] = useState<Bookable[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [resourceId, setResourceId] = useState("");
  const [bookableId, setBookableId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [can, setCan] = useState<Capabilities>(() => allocationPermissions(null));

  async function refresh() {
    const [allocations, res, tasks, events, role] = await Promise.all([
      apiJson("/api/resource-allocations"),
      apiJson("/api/resources"),
      apiJson("/api/tasks"),
      apiJson("/api/events"),
      fetchSessionRole(),
    ]);
    setItems(allocations);
    setResources(res);
    setBookables([
      ...(tasks as Task[]).map((t) => ({
        id: t.bookableId,
        name: t.name,
        label: `Task: ${t.name}`,
        kind: "Task",
      })),
      ...(events as EventItem[]).map((e) => ({
        id: e.bookableId,
        name: e.name,
        label: `Event: ${e.name}`,
        kind: "Event",
      })),
    ]);
    setCan(allocationPermissions(role));
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, []);

  /** bookableId → "Task: Setup", for the select and the search index (so typing
   *  "task" narrows to task bookings). */
  const bookableLabels = useMemo(
    () => new Map(bookables.map((b) => [b.id, b.label])),
    [bookables],
  );

  /** bookableId → "Setup". The table shows the kind as its own badge, so the
   *  cell wants the bare name rather than the prefixed label. */
  const bookableNames = useMemo(
    () => new Map(bookables.map((b) => [b.id, b.name])),
    [bookables],
  );

  const matches = useMemo(
    () => searchAllocations(query, items, bookableLabels),
    [query, items, bookableLabels],
  );

  function resetForm() {
    setSelectedId(null);
    setResourceId("");
    setBookableId("");
    setStartTime("");
    setEndTime("");
  }

  function openCreate() {
    if (!can.create) return;
    resetForm();
    setError("");
    setDialogOpen(true);
  }

  function openEdit(allocation: Allocation) {
    if (!can.edit) return;
    setSelectedId(allocation.allocationId);
    setResourceId(String(allocation.resourceId));
    setBookableId(String(allocation.bookableId));
    setStartTime(toDatetimeLocal(allocation.startTime));
    setEndTime(toDatetimeLocal(allocation.endTime));
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

  /** Combobox options. `search` is what the fuzzy filter reads, so a resource
   *  is findable by its type as well as its name. */
  const resourceOptions = useMemo(
    () =>
      resources.map((r) => ({
        id: String(r.resourceId),
        name: r.name,
        typeName: r.resourceTypeRel?.name,
        search: `${r.name} ${r.resourceTypeRel?.name ?? ""}`,
      })),
    [resources],
  );

  const bookableOptions = useMemo(
    () =>
      bookables.map((b) => ({
        id: String(b.id),
        name: b.name,
        kind: b.kind,
        search: `${b.kind} ${b.name}`,
      })),
    [bookables],
  );

  const selectedResource =
    resourceOptions.find((o) => o.id === resourceId) ?? null;
  const selectedBookable =
    bookableOptions.find((o) => o.id === bookableId) ?? null;

  const isEditing = selectedId != null;
  const canSubmit = isEditing ? can.edit : can.create;

  return (
    <section className="relative left-1/2 w-screen -translate-x-1/2 -my-8 min-h-[calc(100vh-3.25rem)] bg-linear-to-b from-primary from-0% via-primary via-[45%] to-secondary px-6 py-8 md:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <h1 className="font-heading text-3xl font-medium tracking-tight text-primary-foreground">
            Allocations
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
            <CardTitle>Booked resources</CardTitle>
            <CardDescription>
              Each allocation books one resource against an event or a task for a window of
              time. Select a row to edit it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="allocation-search"
                  type="search"
                  placeholder="Search by resource, type, or booking..."
                  aria-label="Search allocations"
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
                New allocation
              </Button>
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing booked yet. Create an allocation to see it listed here.
              </p>
            ) : matches.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  No allocations match &ldquo;{query}&rdquo;.
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
                      <TableHead>Resource</TableHead>
                      <TableHead>Booked for</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>End</TableHead>
                      <TableHead className="w-0 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matches.map(({ allocation, resourceMatch }) => {
                      const typeName = allocation.resource?.resourceTypeRel?.name;
                      const duration = formatDuration(
                        allocation.startTime,
                        allocation.endTime,
                      );
                      return (
                        <TableRow key={allocation.allocationId}>
                          <TableCell className="text-xs text-muted-foreground tabular-nums">
                            {allocation.allocationId}
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              className="flex w-full flex-wrap items-center gap-2 text-left font-medium hover:underline disabled:cursor-not-allowed disabled:no-underline"
                              disabled={!can.edit}
                              onClick={() => openEdit(allocation)}
                            >
                              {resourceMatch
                                ? resourceMatch.highlight((match, i) => (
                                    <mark
                                      key={i}
                                      className="rounded-xs bg-primary/20 text-foreground"
                                    >
                                      {match}
                                    </mark>
                                  ))
                                : (allocation.resource?.name ?? "Unknown resource")}
                              {typeName && (
                                <Badge
                                  variant="outline"
                                  className="type-swatch"
                                  style={resourceTypeStyle(typeName)}
                                >
                                  {typeName}
                                </Badge>
                              )}
                            </button>
                          </TableCell>
                          <TableCell>
                            <span className="flex flex-wrap items-center gap-2">
                              {allocation.bookable?.bookableType && (
                                <Badge variant="secondary">
                                  {allocation.bookable.bookableType}
                                </Badge>
                              )}
                              <span className="text-sm">
                                {bookableNames.get(allocation.bookableId) ??
                                  `#${allocation.bookableId}`}
                              </span>
                            </span>
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {formatDateTime(allocation.startTime)}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {formatDateTime(allocation.endTime)}
                            {duration ? (
                              <span className="block text-xs text-muted-foreground">
                                {duration}
                              </span>
                            ) : (
                              <span className="block text-xs text-destructive">
                                ends before it starts
                              </span>
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
                                  await apiJson(
                                    `/api/resource-allocations/${allocation.allocationId}`,
                                    "DELETE",
                                  );
                                  if (selectedId === allocation.allocationId) resetForm();
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
        <DialogContent>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              if (!resourceId) {
                setError("Pick a resource before saving.");
                return;
              }
              if (!bookableId) {
                setError("Pick an event or task to book against.");
                return;
              }
              // Nothing server-side rejects an inverted range, so catch it here
              // before a nonsense booking reaches the database.
              if (new Date(endTime).getTime() <= new Date(startTime).getTime()) {
                setError("The end time must be after the start time.");
                return;
              }
              setPending(true);
              try {
                const payload = {
                  resourceId: Number(resourceId),
                  bookableId: Number(bookableId),
                  startTime: new Date(startTime).toISOString(),
                  endTime: new Date(endTime).toISOString(),
                };
                if (isEditing) {
                  await apiJson(
                    `/api/resource-allocations/${selectedId}`,
                    "PATCH",
                    payload,
                  );
                } else {
                  await apiJson("/api/resource-allocations", "POST", payload);
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
              <DialogTitle>
                {isEditing ? "Update allocation" : "New allocation"}
              </DialogTitle>
              <DialogDescription>
                Book a resource against an event or task for a window of time.
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
                <Label htmlFor="allocation-resource">Resource</Label>
                <Combobox
                  items={resourceOptions}
                  value={selectedResource}
                  onValueChange={(option) => setResourceId(option ? option.id : "")}
                  itemToStringLabel={(option) => option.name}
                  isItemEqualToValue={(a, b) => a?.id === b?.id}
                  filter={(item, query) => fuzzyMatches(item.search, query)}
                >
                  <ComboboxInput
                    id="allocation-resource"
                    placeholder="Search resources..."
                    disabled={!canSubmit}
                    showClear
                    className="w-full"
                  />
                  <ComboboxContent>
                    <ComboboxEmpty>No resources match.</ComboboxEmpty>
                    <ComboboxList>
                      <ComboboxCollection>
                        {(option: (typeof resourceOptions)[number]) => (
                          <ComboboxItem key={option.id} value={option}>
                            <span className="flex min-w-0 flex-1 items-center gap-2">
                              {option.typeName && (
                                <span
                                  className="type-dot size-2.5 shrink-0 rounded-full"
                                  style={resourceTypeStyle(option.typeName)}
                                />
                              )}
                              <span className="truncate">{option.name}</span>
                              {option.typeName && (
                                <Badge
                                  variant="outline"
                                  className="type-swatch ml-auto shrink-0"
                                  style={resourceTypeStyle(option.typeName)}
                                >
                                  {option.typeName}
                                </Badge>
                              )}
                            </span>
                          </ComboboxItem>
                        )}
                      </ComboboxCollection>
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                <p className="text-xs text-muted-foreground">
                  Search by resource name or type.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="allocation-bookable">Booked for</Label>
                <Combobox
                  items={bookableOptions}
                  value={selectedBookable}
                  onValueChange={(option) => setBookableId(option ? option.id : "")}
                  itemToStringLabel={(option) => option.name}
                  isItemEqualToValue={(a, b) => a?.id === b?.id}
                  filter={(item, query) => fuzzyMatches(item.search, query)}
                >
                  <ComboboxInput
                    id="allocation-bookable"
                    placeholder="Search events and tasks..."
                    disabled={!canSubmit}
                    showClear
                    className="w-full"
                  />
                  <ComboboxContent>
                    <ComboboxEmpty>No events or tasks match.</ComboboxEmpty>
                    <ComboboxList>
                      <ComboboxCollection>
                        {(option: (typeof bookableOptions)[number]) => (
                          <ComboboxItem key={option.id} value={option}>
                            <span className="flex min-w-0 flex-1 items-center gap-2">
                              <Badge variant="secondary" className="shrink-0">
                                {option.kind}
                              </Badge>
                              <span className="truncate">{option.name}</span>
                            </span>
                          </ComboboxItem>
                        )}
                      </ComboboxCollection>
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                {bookables.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No events or tasks exist yet — create one first.
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="allocation-start">Start</Label>
                  <Input
                    id="allocation-start"
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    disabled={!canSubmit}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="allocation-end">End</Label>
                  <Input
                    id="allocation-end"
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    disabled={!canSubmit}
                    required
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  pending || !canSubmit || resources.length === 0 || bookables.length === 0
                }
              >
                {isEditing ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
