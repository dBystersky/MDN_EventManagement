"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { RemovableChip } from "./form-controls";
import { resourceLabel } from "./helpers";
import type { Resource } from "./types";

export function ResourceSearch({
  resources,
  selectedIds,
  onChange,
}: {
  resources: Resource[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = q
    ? resources.filter((resource) => {
        if (selectedIds.includes(String(resource.resourceId))) return false;
        const haystack = `${resource.name} ${resource.resourceTypeRel?.name ?? ""}`.toLowerCase();
        return haystack.includes(q);
      })
    : [];

  return (
    <div className="space-y-2">
      <Label
        htmlFor="subtask-resource-search"
        className="text-xs font-medium tracking-wide uppercase"
      >
        Resources & equipment
      </Label>
      <p className="text-xs text-muted-foreground">
        Search to attach inventory for this subtask.
      </p>
      <Input
        id="subtask-resource-search"
        placeholder="Search by name or type..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {matches.length > 0 && (
        <div className="rounded-lg border bg-background p-1">
          {matches.slice(0, 6).map((resource) => (
            <Button
              key={resource.resourceId}
              type="button"
              variant="ghost"
              className="w-full justify-start"
              onClick={() => {
                onChange([...selectedIds, String(resource.resourceId)]);
                setQuery("");
              }}
            >
              {resourceLabel(resource)}
            </Button>
          ))}
        </div>
      )}
      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map((selectedId) => {
            const resource = resources.find(
              (item) => String(item.resourceId) === selectedId,
            );
            return (
              <RemovableChip
                key={selectedId}
                label={resourceLabel(resource)}
                onRemove={() =>
                  onChange(selectedIds.filter((id) => id !== selectedId))
                }
              />
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No resources assigned yet — search above to add.
        </p>
      )}
    </div>
  );
}
