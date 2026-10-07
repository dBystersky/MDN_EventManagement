"use client";

import { useEffect, useMemo, useState } from "react";
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
import { defaultEndFor, formatDateTime, formatDuration, toDatetimeLocal } from "@/lib/datetime";
import { ConflictAlert, ConflictBadge } from "@/components/conflict-flags";
import { conflictsByAllocation, type Conflict } from "@/lib/conflicts";
import { allocationPermissions, fetchSessionRole, type Capabilities } from "@/lib/permissions";
import { resourceTypeStyle } from "@/lib/resourceTypeColor";
import { fuzzyMatches } from "@/lib/fuzzyFilter";
import { searchAllocations } from "@/lib/fuzzyAllocations";
import { ApiError, apiJson } from "@/lib/api-json";
import { useFieldValidation } from "@/hooks/use-field-validation";
import { isInPast, validateAllocation } from "@/lib/validation";

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
  /** Every clash in the system, for the badges on the table. */
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  /**
   * The last answered clash check, tagged with the dialog state it was asked
   * for, so a slow reply for an earlier edit cannot surface against a newer one.
   */
  const [checked, setChecked] = useState<{ key: string; conflicts: Conflict[] } | null>(null);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [can, setCan] = useState<Capabilities>(() => allocationPermissions(null));
  const validation = useFieldValidation(
    { resourceId, bookableId, startTime, endTime },
    validateAllocation,
  );

  async function refresh() {
    const [allocations, res, tasks, events, conflictList, role] = await Promise.all([
      apiJson("/api/resource-allocations"),
      apiJson("/api/resources"),
      apiJson("/api/tasks"),
      apiJson("/api/events"),
      apiJson("/api/conflicts"),
      fetchSessionRole(),
    ]);
    setItems(allocations);
    setConflicts(conflictList);
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
  const bookableLabels = useMemo(() => new Map(bookables.map((b) => [b.id, b.label])), [bookables]);

  /** bookableId → "Setup". The table shows the kind as its own badge, so the
   *  cell wants the bare name rather than the prefixed label. */
  const bookableNames = useMemo(() => new Map(bookables.map((b) => [b.id, b.name])), [bookables]);

  const matches = useMemo(
    () => searchAllocations(query, items, bookableLabels),
    [query, items, bookableLabels],
  );

  /** allocationId → its clashes, so a row can be badged without a scan. */
  const conflictIndex = useMemo(() => conflictsByAllocation(conflicts), [conflicts]);

  /** The booking as currently drafted, or null while the dialog is incomplete. */
  const candidate = useMemo(() => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (
      !dialogOpen ||
      !resourceId ||
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      return null;
    }
    return {
      kind: "allocation" as const,
      resourceId: Number(resourceId),
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      bookableId: bookableId ? Number(bookableId) : undefined,
      excludeAllocationId: selectedId ?? undefined,
    };
  }, [dialogOpen, resourceId, bookableId, startTime, endTime, selectedId]);

  const candidateKey = candidate ? JSON.stringify(candidate) : null;

  /** Clash check while the dialog is open, so a double-booking shows before save. */
  useEffect(() => {
    if (!candidate || !candidateKey) return;
    const timer = window.setTimeout(() => {
      apiJson("/api/conflicts/preview", "POST", candidate)
        .then((found: Conflict[]) => setChecked({ key: candidateKey, conflicts: found }))
        // A failed check must not read as "no clashes found".
        .catch(() => undefined);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [candidate, candidateKey]);

  /** Only the clashes computed for exactly this draft. */
  const draftConflicts = candidateKey && checked?.key === candidateKey ? checked.conflicts : [];

  /** Picking a start fills in an end two hours later, unless one is already set. */
  function changeStartTime(value: string) {
    setStartTime(value);
    validation.touch("startTime");
    if (!endTime) setEndTime(defaultEndFor(value));
  }

  function resetForm() {
    setSelectedId(null);
    setResourceId("");
    setBookableId("");
    setStartTime("");
    setEndTime("");
    validation.reset();
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
    validation.reset();
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

  const selectedResource = resourceOptions.find((o) => o.id === resourceId) ?? null;
  const selectedBookable = bookableOptions.find((o) => o.id === bookableId) ?? null;

  const isEditing = selectedId != null;
  const canSubmit = isEditing ? can.edit : can.create;

  return (
    <section>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Allocations</h1>
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
              Each allocation books one resource against an event or a task for a window of time.
              Select a row to edit it.
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
              <div className="min-w-0 overflow-x-auto">
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
                      const duration = formatDuration(allocation.startTime, allocation.endTime);
                      const rowConflicts = conflictIndex.get(allocation.allocationId) ?? [];
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
                              <ConflictBadge conflicts={rowConflicts} />
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
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              // Same rules the server enforces, so the dialog answers without a
              // round trip.
              if (!validation.checkBeforeSubmit(e.currentTarget)) return;
              setPending(true);
              try {
                const payload = {
                  resourceId: Number(resourceId),
                  bookableId: Number(bookableId),
                  startTime: new Date(startTime).toISOString(),
                  endTime: new Date(endTime).toISOString(),
                };
                if (isEditing) {
                  await apiJson(`/api/resource-allocations/${selectedId}`, "PATCH", payload);
                } else {
                  await apiJson("/api/resource-allocations", "POST", payload);
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
              <DialogTitle>{isEditing ? "Update allocation" : "New allocation"}</DialogTitle>
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

              <ConflictAlert
                conflicts={draftConflicts}
                title="This resource is already booked then"
                hint="Clashes are flagged, not blocked — you can still save this booking."
              />

              <div className="space-y-2">
                <Label htmlFor="allocation-resource">Resource</Label>
                <Combobox
                  items={resourceOptions}
                  value={selectedResource}
                  onValueChange={(option) => {
                    setResourceId(option ? option.id : "");
                    validation.touch("resourceId");
                  }}
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
                    {...validation.fieldProps("resourceId", "allocation-resource")}
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
                <FieldError id="allocation-resource-error">
                  {validation.errorFor("resourceId")}
                </FieldError>
                <p className="text-xs text-muted-foreground">Search by resource name or type.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="allocation-bookable">Booked for</Label>
                <Combobox
                  items={bookableOptions}
                  value={selectedBookable}
                  onValueChange={(option) => {
                    setBookableId(option ? option.id : "");
                    validation.touch("bookableId");
                  }}
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
                    {...validation.fieldProps("bookableId", "allocation-bookable")}
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
                <FieldError id="allocation-bookable-error">
                  {validation.errorFor("bookableId")}
                </FieldError>
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
                    onChange={(e) => changeStartTime(e.target.value)}
                    disabled={!canSubmit}
                    required
                    {...validation.fieldProps("startTime", "allocation-start")}
                  />
                  <FieldError id="allocation-start-error">
                    {validation.errorFor("startTime")}
                  </FieldError>
                  {!validation.errorFor("startTime") && isInPast(startTime) && (
                    <FieldDescription>This is in the past.</FieldDescription>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="allocation-end">End</Label>
                  <Input
                    id="allocation-end"
                    type="datetime-local"
                    value={endTime}
                    min={startTime || undefined}
                    onChange={(e) => {
                      setEndTime(e.target.value);
                      validation.touch("endTime");
                    }}
                    disabled={!canSubmit}
                    required
                    {...validation.fieldProps("endTime", "allocation-end")}
                  />
                  <FieldError id="allocation-end-error">
                    {validation.errorFor("endTime")}
                  </FieldError>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={pending || !canSubmit || resources.length === 0 || bookables.length === 0}
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
