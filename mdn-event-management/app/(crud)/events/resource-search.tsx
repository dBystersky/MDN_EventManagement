"use client";

import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { fuzzyMatches } from "@/lib/fuzzyFilter";

import { RemovableChip } from "./form-controls";
import { resourceLabel } from "./helpers";
import type { Resource } from "./types";

type ResourceOption = { id: string; label: string };

export function ResourceSearch({
  resources,
  selectedIds,
  onChange,
}: {
  resources: Resource[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  // Clicking the box lists everything not yet picked; typing narrows it.
  const options: ResourceOption[] = resources
    .filter((resource) => !selectedIds.includes(String(resource.resourceId)))
    .map((resource) => ({ id: String(resource.resourceId), label: resourceLabel(resource) }));

  return (
    <div className="space-y-2">
      <Label
        htmlFor="subtask-resource-search"
        className="text-xs font-medium tracking-wide uppercase"
      >
        Resources & equipment
      </Label>
      <p className="text-xs text-muted-foreground">Pick inventory to attach to this subtask.</p>
      {/* Picking a resource adds it straight away; the input then clears. */}
      <Combobox
        key={selectedIds.join("-") || "none"}
        items={options}
        value={null as ResourceOption | null}
        onValueChange={(option) => {
          if (option && !selectedIds.includes(option.id)) {
            onChange([...selectedIds, option.id]);
          }
        }}
        itemToStringLabel={(option) => option.label}
        isItemEqualToValue={(a, b) => a?.id === b?.id}
        filter={(item, query) => fuzzyMatches(item.label, query)}
      >
        <ComboboxInput
          id="subtask-resource-search"
          placeholder={
            options.length === 0 ? "No more resources to add" : "Search by name or type..."
          }
          disabled={options.length === 0}
          className="w-full"
        />
        <ComboboxContent>
          <ComboboxEmpty>No resources match.</ComboboxEmpty>
          <ComboboxList>
            <ComboboxCollection>
              {(option: ResourceOption) => (
                <ComboboxItem key={option.id} value={option}>
                  <span className="truncate">{option.label}</span>
                </ComboboxItem>
              )}
            </ComboboxCollection>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map((selectedId) => {
            const resource = resources.find((item) => String(item.resourceId) === selectedId);
            return (
              <RemovableChip
                key={selectedId}
                label={resourceLabel(resource)}
                onRemove={() => onChange(selectedIds.filter((id) => id !== selectedId))}
              />
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No resources assigned yet.</p>
      )}
    </div>
  );
}
