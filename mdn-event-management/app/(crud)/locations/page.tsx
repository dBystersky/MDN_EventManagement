"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleAlertIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react";
import fuzzysort, { type Result } from "fuzzysort";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchSessionRole, locationPermissions, type Capabilities } from "@/lib/permissions";
import { apiJson } from "@/lib/api-json";

type Location = { locationId: number; name: string };

const MIN_SCORE = 0.2;

export default function LocationsDemo() {
  const [items, setItems] = useState<Location[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [can, setCan] = useState<Capabilities>(() => locationPermissions(null));

  async function refresh() {
    const [locations, role] = await Promise.all([
      apiJson("/api/locations"),
      fetchSessionRole(),
    ]);
    setItems(locations);
    setCan(locationPermissions(role));
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, []);

  function resetForm() {
    setSelectedId(null);
    setName("");
  }

  function openCreate() {
    if (!can.create) return;
    resetForm();
    setError("");
    setDialogOpen(true);
  }

  function openEdit(location: Location) {
    if (!can.edit) return;
    setSelectedId(location.locationId);
    setName(location.name);
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

  const isEditing = selectedId != null;
  const canSubmit = isEditing ? can.edit : can.create;

  const matches = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return items.map((location) => ({ location, nameMatch: null as Result | null }));
    }

    const results = fuzzysort.go(trimmed, items, {
      key: "name",
      threshold: MIN_SCORE,
      limit: 0,
    });

    return [...results]
      .sort((a, b) => b.score - a.score || a.obj.name.localeCompare(b.obj.name))
      .map((result) => ({
        location: result.obj,
        nameMatch: result.score > 0 ? result : null,
      }));
  }, [query, items]);

  return (
    <section>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold">Locations</h1>
        </header>

        {error && !dialogOpen && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Location list</CardTitle>
            <CardDescription>
              Search by name, then select a row to edit it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="location-search"
                  type="search"
                  placeholder="Search locations..."
                  aria-label="Search locations"
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
                New location
              </Button>
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No locations yet. Create one to see it listed here.
              </p>
            ) : matches.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  No locations match &ldquo;{query}&rdquo;.
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
                      <TableHead className="w-0 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matches.map(({ location, nameMatch }) => (
                      <TableRow key={location.locationId}>
                        <TableCell className="text-xs text-muted-foreground tabular-nums">
                          {location.locationId}
                        </TableCell>
                        <TableCell className="font-medium">
                          {nameMatch
                            ? nameMatch.highlight((match, i) => (
                                <mark
                                  key={i}
                                  className="rounded-xs bg-primary/20 text-foreground"
                                >
                                  {match}
                                </mark>
                              ))
                            : location.name}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="flex justify-end gap-1">
                            <Button
                              type="button"
                              size="xs"
                              variant="secondary"
                              disabled={pending || !can.edit}
                              onClick={() => openEdit(location)}
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
                                    `/api/locations/${location.locationId}`,
                                    "DELETE",
                                  );
                                  if (selectedId === location.locationId) resetForm();
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
                    ))}
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
              setPending(true);
              try {
                if (isEditing) {
                  await apiJson(`/api/locations/${selectedId}`, "PATCH", { name });
                } else {
                  await apiJson("/api/locations", "POST", { name });
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
              <DialogTitle>{isEditing ? "Update location" : "New location"}</DialogTitle>
              <DialogDescription>
                {isEditing
                  ? "Change the selected location, then save."
                  : "Name the venue, then save it to the list."}
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
                <Label htmlFor="location-name">Location name</Label>
                <Input
                  id="location-name"
                  placeholder="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!canSubmit}
                  required
                />
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
