"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CircleAlertIcon } from "lucide-react";

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
import { fetchSessionRole, resourcePermissions, type Capabilities } from "@/lib/permissions";
import { resourceTypeStyle } from "@/lib/resourceTypeColor";
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

  function typeNameFor(resource: Resource) {
    return (
      resource.resourceTypeRel?.name ??
      types.find((type) => type.typeId === resource.resourceType)?.name
    );
  }

  const isEditing = selectedId != null;
  const canSubmit = isEditing ? can.edit : can.create;

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

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
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
              <CardDescription>Select a resource to edit it in the form.</CardDescription>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No resources yet. Create one to see it listed here.
                </p>
              ) : (
                <ul className="space-y-3">
                  {items.map((resource) => {
                    const selected = selectedId === resource.resourceId;
                    const typeName = typeNameFor(resource);
                    return (
                      <li
                        key={resource.resourceId}
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
                            onClick={() => selectResource(resource)}
                          >
                            <p className="font-medium">
                              #{resource.resourceId} {resource.name}
                            </p>
                          </button>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            {typeName && (
                              <Badge
                                variant="outline"
                                className="type-swatch"
                                style={resourceTypeStyle(typeName)}
                              >
                                {typeName}
                              </Badge>
                            )}
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
