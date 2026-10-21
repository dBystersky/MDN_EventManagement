"use client";

import { useState } from "react";
import { CircleAlertIcon, XIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Capabilities } from "@/lib/permissions";
import { resourceTypeStyle } from "@/lib/resourceTypeColor";
import { ApiError, apiJson } from "@/lib/api-json";
import { useFieldValidation } from "@/hooks/use-field-validation";
import { validateNamed } from "@/lib/validation";

type ResourceType = { typeId: number; name: string };
type Resource = { resourceId: number; resourceType: number };

const validateResourceType = (values: unknown) => validateNamed(values, "resource type");

/**
 * The resource types, managed beside the resource table. The page owns the
 * data; `onChanged` reloads it so the table, its type picker and the counts
 * here all stay in step.
 */
export function ResourceTypesPanel({
  types,
  resources,
  can,
  onChanged,
}: {
  types: ResourceType[];
  resources: Resource[];
  can: Capabilities;
  onChanged: () => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const validation = useFieldValidation({ name }, validateResourceType);

  const isEditing = selectedId != null;
  const canSubmit = isEditing ? can.edit : can.create;

  function resetForm() {
    setSelectedId(null);
    setName("");
    validation.reset();
  }

  function selectType(type: ResourceType) {
    setSelectedId(type.typeId);
    setName(type.name);
    validation.reset();
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
      await onChanged();
    } catch (err) {
      setError(String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Types</CardTitle>
        <CardDescription>
          {can.edit
            ? "Categories resources belong to. Select one to rename it."
            : "Categories resources belong to."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {types.length === 0 ? (
          <p className="text-sm text-muted-foreground">No types yet.</p>
        ) : (
          <ul className="space-y-1">
            {types.map((type) => {
              const count = resourceCountFor(type.typeId);
              const confirming = confirmDeleteId === type.typeId;
              const badge = (
                <Badge
                  variant="outline"
                  className="type-swatch"
                  style={resourceTypeStyle(type.name)}
                >
                  {type.name}
                </Badge>
              );
              return (
                <li
                  key={type.typeId}
                  className={
                    selectedId === type.typeId
                      ? "rounded-lg bg-muted p-2 ring-2 ring-primary"
                      : "rounded-lg p-2 transition-colors hover:bg-muted"
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    {can.edit ? (
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        aria-label={`Rename ${type.name}`}
                        onClick={() => selectType(type)}
                      >
                        {badge}
                      </button>
                    ) : (
                      <span className="min-w-0 flex-1">{badge}</span>
                    )}
                    <span
                      className="text-xs text-muted-foreground tabular-nums"
                      title={count === 1 ? "1 resource" : `${count} resources`}
                    >
                      {count}
                    </span>
                    {can.delete && (
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        aria-label={`Delete ${type.name}`}
                        disabled={pending || confirming}
                        onClick={() => {
                          setError("");
                          // Deleting a type cascades through its resources and
                          // their allocations, so anything non-empty asks first.
                          if (count > 0) {
                            setConfirmDeleteId(type.typeId);
                            return;
                          }
                          deleteType(type.typeId);
                        }}
                      >
                        <XIcon />
                      </Button>
                    )}
                  </div>

                  {confirming && (
                    <div className="mt-2 space-y-2 rounded-lg bg-destructive/10 p-2">
                      <p className="text-xs text-destructive">
                        Delete {type.name} and its{" "}
                        {count === 1 ? "1 resource" : `${count} resources`}, plus every booking of
                        them? This cannot be undone.
                      </p>
                      <div className="flex justify-end gap-2">
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

        {canSubmit && (
          <form
            noValidate
            className="space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              if (!validation.checkBeforeSubmit(e.currentTarget)) return;
              setPending(true);
              try {
                if (isEditing) {
                  await apiJson(`/api/resource-types/${selectedId}`, "PATCH", { name });
                } else {
                  await apiJson("/api/resource-types", "POST", { name });
                }
                resetForm();
                await onChanged();
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
            <div className="flex gap-2">
              <Input
                id="type-name"
                aria-label={isEditing ? "New name for the type" : "New type name"}
                placeholder={isEditing ? "Rename type" : "New type, e.g. Projector"}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="min-w-0 flex-1"
                {...validation.fieldProps("name", "type-name")}
              />
              <Button type="submit" variant="secondary" disabled={pending}>
                {isEditing ? "Update" : "Add"}
              </Button>
            </div>
            <FieldError id="type-name-error">{validation.errorFor("name")}</FieldError>
            {isEditing && (
              <Button type="button" size="xs" variant="ghost" onClick={resetForm}>
                Cancel rename
              </Button>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
