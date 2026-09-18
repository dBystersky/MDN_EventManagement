"use client";

import { useState, type ReactNode } from "react";
import { XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { Option } from "./types";

export function Field({
  id,
  label,
  children,
}: {
  id?: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

export function OptionSelect({
  id,
  value,
  placeholder,
  options,
  onChange,
  className,
}: {
  id?: string;
  value: string;
  placeholder: string;
  options: Option[];
  onChange: (id: string) => void;
  className?: string;
}) {
  const labelFor = (optionId: string) =>
    options.find((option) => option.id === optionId)?.label ?? "";

  return (
    <Select
      value={value || null}
      items={options.map((option) => ({ value: option.id, label: option.label }))}
      itemToStringLabel={(item) => labelFor(String(item))}
      onValueChange={(item) => onChange(item == null ? "" : String(item))}
    >
      <SelectTrigger id={id} className={className ?? "w-full"}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false}>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function RemovableChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  const text = label || "Unknown";
  return (
    <Badge variant="secondary" className="gap-1 pr-1">
      {text}
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        aria-label={`Remove ${text}`}
        onClick={onRemove}
      >
        <XIcon />
      </Button>
    </Badge>
  );
}

export function AssignmentPicker({
  id,
  label,
  placeholder,
  options,
  selectedIds,
  onChange,
  showSelected = true,
}: {
  id: string;
  label: string;
  placeholder: string;
  options: Option[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  showSelected?: boolean;
}) {
  const [pendingId, setPendingId] = useState("");
  const available = options.filter((option) => !selectedIds.includes(option.id));
  const labelFor = (optionId: string) =>
    options.find((option) => option.id === optionId)?.label ?? "";

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <OptionSelect
          id={id}
          value={pendingId}
          placeholder={placeholder}
          options={available}
          onChange={setPendingId}
          className="min-w-0 flex-1"
        />
        <Button
          type="button"
          variant="secondary"
          disabled={!pendingId}
          onClick={() => {
            if (!pendingId || selectedIds.includes(pendingId)) return;
            onChange([...selectedIds, pendingId]);
            setPendingId("");
          }}
        >
          Add
        </Button>
      </div>
      {showSelected && selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map((selectedId) => (
            <RemovableChip
              key={selectedId}
              label={labelFor(selectedId)}
              onRemove={() => onChange(selectedIds.filter((id) => id !== selectedId))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
