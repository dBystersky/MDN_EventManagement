"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClockIcon, CircleAlertIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react";

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
import { fetchSessionRole, resourcePermissions, type Capabilities } from "@/lib/permissions";
import { resourceTypeStyle } from "@/lib/resourceTypeColor";
import { fuzzyMatches } from "@/lib/fuzzyFilter";
import { searchResources, typeNameOf } from "@/lib/fuzzyResources";
import type { Booking } from "@/lib/timeline";
import { ResourceTimeline } from "./resource-timeline";
import { apiJson } from "@/lib/api-json";

type ResourceType = { typeId: number; name: string };
type Allocation = {
  allocationId: number;
  resourceId: number;
  bookableId: number;
  startTime: string;
  endTime: string;
  bookable?: { bookableId: number; bookableType: string };
};
type Task = { taskId: number; name: string; bookableId: number };
type EventItem = { eventId: number; name: string; bookableId: number };
type Resource = {
  resourceId: number;
  name: string;
  resourceType: number;
  resourceTypeRel?: { typeId: number; name: string };
};

export default function ResourcesDemo() {
  const [items, setItems] = useState<Resource[]>([]);
  const [types, setTypes] = useState<ResourceType[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [resourceTypeId, setResourceTypeId] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [bookableNames, setBookableNames] = useState<Map<number, string>>(new Map());
  const [timelineFor, setTimelineFor] = useState<Resource | null>(null);
  const [can, setCan] = useState<Capabilities>(() => resourcePermissions(null));

  async function refresh() {
    const [resources, resourceTypes, allocationList, tasks, events, role] =
      await Promise.all([
        apiJson("/api/resources"),
        apiJson("/api/resource-types"),
        apiJson("/api/resource-allocations"),
        apiJson("/api/tasks"),
        apiJson("/api/events"),
        fetchSessionRole(),
      ]);
    setItems(resources);
    setTypes(resourceTypes);
    setAllocations(allocationList);
    setBookableNames(
      new Map<number, string>([
        ...(tasks as Task[]).map((t) => [t.bookableId, t.name] as [number, string]),
        ...(events as EventItem[]).map((e) => [e.bookableId, e.name] as [number, string]),
      ]),
    );
    setCan(resourcePermissions(role));
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, []);

  function resetForm() {
    setSelectedId(null);
    setName("");
    setResourceTypeId("");
  }

  function openCreate() {
    if (!can.create) return;
    resetForm();
    setError("");
    setDialogOpen(true);
  }

  function openEdit(resource: Resource) {
    if (!can.edit) return;
    setSelectedId(resource.resourceId);
    setName(resource.name);
    setResourceTypeId(String(resource.resourceType));
    setError("");
    setDialogOpen(true);
  }

  /** Closing by any route — Cancel, Escape, backdrop, the X — clears the form so
   *  the next open never inherits the last edit. */
  function handleOpenChange(open: boolean) {
    setDialogOpen(open);
    if (!open) {
      resetForm();
      setError("");
    }
  }

  /** Bookings for whichever resource the timeline is open on. */
  const timelineBookings: Booking[] = useMemo(() => {
    if (!timelineFor) return [];
    return allocations
      .filter((a) => a.resourceId === timelineFor.resourceId)
      .map((a) => ({
        allocationId: a.allocationId,
        startTime: a.startTime,
        endTime: a.endTime,
        label:
          bookableNames.get(a.bookableId) ??
          `${a.bookable?.bookableType ?? "Booking"} #${a.bookableId}`,
        kind: a.bookable?.bookableType,
      }));
  }, [timelineFor, allocations, bookableNames]);

  const typeOptions = useMemo(
    () => types.map((type) => ({ id: String(type.typeId), name: type.name })),
    [types],
  );
  const selectedType = typeOptions.find((o) => o.id === resourceTypeId) ?? null;

  const isEditing = selectedId != null;
  const canSubmit = isEditing ? can.edit : can.create;

  const matches = useMemo(
    () => searchResources(query, items, types),
    [query, items, types],
  );

  return (
    <section className="relative left-1/2 w-screen -translate-x-1/2 -my-8 min-h-[calc(100vh-3.25rem)] bg-linear-to-b from-primary from-0% via-primary via-[45%] to-secondary px-6 py-8 md:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <h1 className="font-heading text-3xl font-medium tracking-tight text-primary-foreground">
            Resources
          </h1>
        </header>

        {/* While the dialog is open its own alert carries the message, so this
            one would be hidden behind the backdrop. */}
        {error && !dialogOpen && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Resource list</CardTitle>
            <CardDescription>
              Search by resource or type name, then select a row to edit it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="resource-search"
                  type="search"
                  placeholder="Search resources..."
                  aria-label="Search resources"
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
                New resource
              </Button>
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No resources yet. Create one to see it listed here.
              </p>
            ) : matches.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  No resources match &ldquo;{query}&rdquo;.
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
                      <TableHead>Type</TableHead>
                      <TableHead className="w-0 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matches.map(({ resource, nameMatch }) => {
                      const typeName = typeNameOf(resource, types);
                      return (
                        <TableRow key={resource.resourceId}>
                          <TableCell className="text-xs text-muted-foreground tabular-nums">
                            {resource.resourceId}
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              className="w-full text-left font-medium hover:underline"
                              title={`Show when ${resource.name} is booked`}
                              onClick={() => setTimelineFor(resource)}
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
                                : resource.name}
                            </button>
                          </TableCell>
                          <TableCell>
                            {typeName && (
                              <Badge
                                variant="outline"
                                className="type-swatch"
                                style={resourceTypeStyle(typeName)}
                              >
                                {typeName}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="flex justify-end gap-1">
                            <Button
                              type="button"
                              size="xs"
                              variant="ghost"
                              aria-label={`Show bookings for ${resource.name}`}
                              disabled={pending}
                              onClick={() => setTimelineFor(resource)}
                            >
                              <CalendarClockIcon />
                            </Button>
                            <Button
                              type="button"
                              size="xs"
                              variant="secondary"
                              disabled={pending || !can.edit}
                              onClick={() => openEdit(resource)}
                            >
                              Edit
                            </Button>
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
                                    `/api/resources/${resource.resourceId}`,
                                    "DELETE",
                                  );
                                  if (selectedId === resource.resourceId) resetForm();
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
                            </span>
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

      <Dialog
        open={timelineFor != null}
        onOpenChange={(open) => {
          if (!open) setTimelineFor(null);
        }}
      >
        {/* Wider than the edit dialog's default: a time axis needs room. */}
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {timelineFor?.name}
              {timelineFor &&
                (() => {
                  const typeName = typeNameOf(timelineFor, types);
                  return typeName ? (
                    <Badge
                      variant="outline"
                      className="type-swatch"
                      style={resourceTypeStyle(typeName)}
                    >
                      {typeName}
                    </Badge>
                  ) : null;
                })()}
            </DialogTitle>
            <DialogDescription>When this resource is booked.</DialogDescription>
          </DialogHeader>

          {/* min-w-0: DialogContent is a grid, and a grid item defaults to
              min-width:auto — without this it stretches to the plot's full
              intrinsic width instead of letting the scroller clip it. */}
          <div className="min-w-0 py-2">
            <ResourceTimeline
              bookings={timelineBookings}
              typeName={timelineFor ? typeNameOf(timelineFor, types) : undefined}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setTimelineFor(null)}>
              Close
            </Button>
            <Button
              type="button"
              disabled={!can.edit}
              onClick={() => {
                const target = timelineFor;
                setTimelineFor(null);
                if (target) openEdit(target);
              }}
            >
              Edit resource
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              if (!resourceTypeId) {
                setError("Pick a resource type before saving.");
                return;
              }
              setPending(true);
              try {
                const payload = { name, resourceTypeId: Number(resourceTypeId) };
                if (isEditing) {
                  await apiJson(`/api/resources/${selectedId}`, "PATCH", payload);
                } else {
                  await apiJson("/api/resources", "POST", payload);
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
              <DialogTitle>{isEditing ? "Update resource" : "New resource"}</DialogTitle>
              <DialogDescription>
                {isEditing
                  ? "Change the selected resource, then save."
                  : "Name the resource, then pick the type it belongs to."}
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
                <Label htmlFor="resource-name">Resource name</Label>
                <Input
                  id="resource-name"
                  placeholder="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!canSubmit}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="resource-type">Resource type</Label>
                <Combobox
                  items={typeOptions}
                  value={selectedType}
                  onValueChange={(option) => setResourceTypeId(option ? option.id : "")}
                  itemToStringLabel={(option) => option.name}
                  isItemEqualToValue={(a, b) => a?.id === b?.id}
                  filter={(item, query) => fuzzyMatches(item.name, query)}
                >
                  <ComboboxInput
                    id="resource-type"
                    placeholder="Search types..."
                    disabled={!canSubmit}
                    showClear
                    className="w-full"
                  />
                  <ComboboxContent>
                    <ComboboxEmpty>No types match.</ComboboxEmpty>
                    <ComboboxList>
                      <ComboboxCollection>
                        {(option: (typeof typeOptions)[number]) => (
                          <ComboboxItem key={option.id} value={option}>
                            <span className="flex min-w-0 flex-1 items-center gap-2">
                              <span
                                className="type-dot size-2.5 shrink-0 rounded-full"
                                style={resourceTypeStyle(option.name)}
                              />
                              <span className="truncate">{option.name}</span>
                            </span>
                          </ComboboxItem>
                        )}
                      </ComboboxCollection>
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                {types.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No types exist yet.{" "}
                    <Link
                      href="/resource-types"
                      className="text-primary underline underline-offset-4"
                    >
                      Create a resource type
                    </Link>{" "}
                    first.
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !canSubmit || types.length === 0}>
                {isEditing ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
