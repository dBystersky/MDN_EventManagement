"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CircleAlertIcon, SearchIcon, XIcon } from "lucide-react";

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
import { searchResources, typeNameOf } from "@/lib/fuzzyResources";
import { apiJson } from "../api";

type ResourceType = { typeId: number; name: string };
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
  const [can, setCan] = useState<Capabilities>(() => resourcePermissions(null));

  async function refresh() {
    const [resources, resourceTypes, role] = await Promise.all([
      apiJson("/api/resources"),
      apiJson("/api/resource-types"),
      fetchSessionRole(),
    ]);
    setItems(resources);
    setTypes(resourceTypes);
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

  function selectResource(resource: Resource) {
    if (!can.edit) return;
    setSelectedId(resource.resourceId);
    setName(resource.name);
    setResourceTypeId(String(resource.resourceType));
    setError("");
  }

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

        {error && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>Could not save</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
          <Card>
            <CardHeader>
              <CardTitle>{isEditing ? "Update resource" : "Resource details"}</CardTitle>
              <CardDescription>
                {isEditing
                  ? "Change the selected resource, then save."
                  : "Name the resource, then pick the type it belongs to."}
              </CardDescription>
            </CardHeader>
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
                  resetForm();
                  await refresh();
                } catch (err) {
                  setError(String(err));
                } finally {
                  setPending(false);
                }
              }}
            >
              <CardContent className="space-y-4 pb-4">
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
                  <Select
                    value={resourceTypeId || null}
                    items={types.map((type) => ({
                      value: String(type.typeId),
                      label: type.name,
                    }))}
                    itemToStringLabel={(value) =>
                      types.find((type) => String(type.typeId) === String(value))?.name ?? ""
                    }
                    onValueChange={(value) =>
                      setResourceTypeId(value == null ? "" : String(value))
                    }
                  >
                    <SelectTrigger id="resource-type" className="w-full" disabled={!canSubmit}>
                      <SelectValue placeholder="Type..." />
                    </SelectTrigger>
                    <SelectContent align="start" alignItemWithTrigger={false}>
                      {types.map((type) => (
                        <SelectItem key={type.typeId} value={String(type.typeId)}>
                          <span className="flex items-center gap-2">
                            <span
                              className="type-dot size-2.5 shrink-0 rounded-full"
                              style={resourceTypeStyle(type.name)}
                            />
                            {type.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {types.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No types exist yet.{" "}
                      <Link
                        href="/demo/resource-types"
                        className="text-primary underline underline-offset-4"
                      >
                        Create a resource type
                      </Link>{" "}
                      first.
                    </p>
                  )}
                </div>
              </CardContent>
              <CardFooter className="justify-end gap-2">
                {isEditing && (
                  <Button type="button" variant="ghost" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
                <Button type="submit" disabled={pending || !canSubmit || types.length === 0}>
                  {isEditing ? "Update" : "Create"}
                </Button>
              </CardFooter>
            </form>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resource list</CardTitle>
              <CardDescription>
                Search by resource or type name, then select a row to edit it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
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
                        const selected = selectedId === resource.resourceId;
                        const typeName = typeNameOf(resource, types);
                        return (
                          <TableRow
                            key={resource.resourceId}
                            className={selected ? "bg-muted" : undefined}
                          >
                            <TableCell className="text-xs text-muted-foreground tabular-nums">
                              {resource.resourceId}
                            </TableCell>
                            <TableCell>
                              <button
                                type="button"
                                className="w-full text-left font-medium hover:underline"
                                onClick={() => selectResource(resource)}
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
      </div>
    </section>
  );
}
