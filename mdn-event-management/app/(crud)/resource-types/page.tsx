"use client";

import { useEffect, useState } from "react";
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
import { fetchSessionRole, resourceTypePermissions, type Capabilities } from "@/lib/permissions";
import { resourceTypeStyle } from "@/lib/resourceTypeColor";
import { apiJson } from "@/lib/api-json";

type ResourceType = { typeId: number; name: string };
type Resource = { resourceId: number; resourceType: number };

export default function ResourceTypesDemo() {
  const [items, setItems] = useState<ResourceType[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [can, setCan] = useState<Capabilities>(() => resourceTypePermissions(null));

  async function refresh() {
    const [types, resourceList, role] = await Promise.all([
      apiJson("/api/resource-types"),
      apiJson("/api/resources"),
      fetchSessionRole(),
    ]);
    setItems(types);
    setResources(resourceList);
    setCan(resourceTypePermissions(role));
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, []);

  function resetForm() {
    setSelectedId(null);
    setName("");
  }

  function selectType(type: ResourceType) {
    if (!can.edit) return;
    setSelectedId(type.typeId);
    setName(type.name);
    setError("");
  }

  /** How many resources this type would take with it if deleted. */
  function resourceCountFor(typeId: number) {
    return resources.filter((resource) => resource.resourceType === typeId).length;
  }

  async function deleteType(typeId: number) {
    setError("");
    setPending(true);
    try {
      await apiJson(`/api/resource-types/${typeId}`, "DELETE");
      if (selectedId === typeId) resetForm();
      setConfirmDeleteId(null);
      await refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setPending(false);
    }
  }

  const isEditing = selectedId != null;

  return (
    <section className="relative left-1/2 w-screen -translate-x-1/2 -my-8 min-h-[calc(100vh-3.25rem)] bg-linear-to-b from-primary from-0% via-primary via-[45%] to-secondary px-6 py-8 md:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <h1 className="font-heading text-3xl font-medium tracking-tight text-primary-foreground">
            Resource types
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
              <CardTitle>{isEditing ? "Update type" : "Type details"}</CardTitle>
              <CardDescription>
                {isEditing
                  ? "Change the selected type, then save."
                  : "Name a category that resources can belong to, like Projector or Venue."}
              </CardDescription>
            </CardHeader>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError("");
                setPending(true);
                try {
                  if (isEditing) {
                    await apiJson(`/api/resource-types/${selectedId}`, "PATCH", { name });
                  } else {
                    await apiJson("/api/resource-types", "POST", { name });
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
                  <Label htmlFor="type-name">Type name</Label>
                  <Input
                    id="type-name"
                    placeholder="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isEditing ? !can.edit : !can.create}
                    required
                  />
                  {name.trim() && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      Colour:
                      <Badge
                        variant="outline"
                        className="type-swatch"
                        style={resourceTypeStyle(name)}
                      >
                        {name}
                      </Badge>
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
                <Button type="submit" disabled={pending || (isEditing ? !can.edit : !can.create)}>
                  {isEditing ? "Update" : "Create"}
                </Button>
              </CardFooter>
            </form>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Type list</CardTitle>
              <CardDescription>Select a type to edit it in the form.</CardDescription>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No resource types yet. Create one to see it listed here.
                </p>
              ) : (
                <ul className="space-y-3">
                  {items.map((type) => {
                    const selected = selectedId === type.typeId;
                    const count = resourceCountFor(type.typeId);
                    const confirming = confirmDeleteId === type.typeId;
                    return (
                      <li
                        key={type.typeId}
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
                            onClick={() => selectType(type)}
                          >
                            <p className="flex flex-wrap items-center gap-2 font-medium">
                              <span className="text-muted-foreground">#{type.typeId}</span>
                              <Badge
                                variant="outline"
                                className="type-swatch"
                                style={resourceTypeStyle(type.name)}
                              >
                                {type.name}
                              </Badge>
                            </p>
                          </button>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <Badge variant="secondary">
                              {count === 1 ? "1 resource" : `${count} resources`}
                            </Badge>
                            {!confirming && (
                              <Button
                                type="button"
                                size="xs"
                                variant="destructive"
                                disabled={pending || !can.delete}
                                onClick={() => {
                                  setError("");
                                  // Deleting a type cascades through its
                                  // resources and their allocations, so anything
                                  // non-empty asks first.
                                  if (count > 0) {
                                    setConfirmDeleteId(type.typeId);
                                    return;
                                  }
                                  deleteType(type.typeId);
                                }}
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                        </div>

                        {confirming && (
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-destructive/10 p-2">
                            <p className="text-xs text-destructive">
                              Delete {type.name} and its{" "}
                              {count === 1 ? "1 resource" : `${count} resources`}, plus every
                              booking of them? This cannot be undone.
                            </p>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="xs"
                                variant="ghost"
                                onClick={() => setConfirmDeleteId(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                size="xs"
                                variant="destructive"
                                disabled={pending}
                                onClick={() => deleteType(type.typeId)}
                              >
                                Confirm delete
                              </Button>
                            </div>
                          </div>
                        )}
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
