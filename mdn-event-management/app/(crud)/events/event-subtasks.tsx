"use client";

import { useState } from "react";
import { PlusIcon, XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import type { FieldValidation } from "@/hooks/use-field-validation";
import { fuzzyMatches } from "@/lib/fuzzyFilter";
import type { SubtaskDraftField } from "@/lib/validation";

import { Field, OptionSelect } from "./form-controls";
import { formatSubtaskDate, names } from "./helpers";
import { ResourceSearch } from "./resource-search";
import type { DraftSubtask, Member, Option, Resource } from "./types";

function SubtaskRow({
  title,
  detail,
  badge,
  onRemove,
}: {
  title: string;
  detail: string;
  /** Marks a row that only exists once the event is saved. */
  badge?: string;
  /** Left out when the event is view-only. */
  onRemove?: () => void;
}) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border bg-background p-3">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {title}
          {badge && <Badge variant="outline">{badge}</Badge>}
        </p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      {onRemove && (
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label={`Remove ${title}`}
          onClick={onRemove}
        >
          <XIcon />
        </Button>
      )}
    </li>
  );
}

type AttachOption = Option & { search: string };

export function EventSubtasks({
  taskIds,
  savedTaskIds,
  taskEventId,
  selectedId,
  onTaskIdsChange,
  taskPickerOptions,
  draftSubtasks,
  onRemoveDraft,
  subtaskTitle,
  onSubtaskTitleChange,
  subtaskAssigneeId,
  onSubtaskAssigneeIdChange,
  subtaskDeadline,
  onSubtaskDeadlineChange,
  subtaskValidation,
  subtaskResourceIds,
  onSubtaskResourceIdsChange,
  memberOptions,
  members,
  resources,
  onAddDraft,
  existingDetails,
  readOnly = false,
}: {
  taskIds: string[];
  /** The tasks the event had when it was opened; anything else is newly attached. */
  savedTaskIds: string[];
  /** The event a task currently belongs to, if any. */
  taskEventId: (taskId: string) => number | null;
  selectedId: number | null;
  onTaskIdsChange: (ids: string[]) => void;
  taskPickerOptions: Option[];
  draftSubtasks: DraftSubtask[];
  onRemoveDraft: (key: string) => void;
  subtaskTitle: string;
  onSubtaskTitleChange: (value: string) => void;
  subtaskAssigneeId: string;
  onSubtaskAssigneeIdChange: (value: string) => void;
  subtaskDeadline: string;
  onSubtaskDeadlineChange: (value: string) => void;
  /** Speaks up only when "Add to event" is pressed. */
  subtaskValidation: FieldValidation<SubtaskDraftField>;
  subtaskResourceIds: string[];
  onSubtaskResourceIdsChange: (ids: string[]) => void;
  memberOptions: Option[];
  members: Member[];
  resources: Resource[];
  /** Adds the composed subtask as a draft; false when the composer is incomplete. */
  onAddDraft: () => boolean;
  existingDetails: (taskId: string) => { name: string; detail: string };
  /** Lists the subtasks only — no adding and no removing. */
  readOnly?: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const attachOptions: AttachOption[] = taskPickerOptions
    .filter((option) => !taskIds.includes(option.id))
    .map((option) => ({ ...option, search: option.label }));

  function clearComposer() {
    onSubtaskTitleChange("");
    onSubtaskAssigneeIdChange("");
    onSubtaskDeadlineChange("");
    onSubtaskResourceIdsChange([]);
    subtaskValidation.reset();
  }

  /** Every way in or out of the dialog starts the next one blank. */
  function handleOpenChange(open: boolean) {
    clearComposer();
    setDialogOpen(open);
  }

  const count = taskIds.length + draftSubtasks.length;

  return (
    <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-medium">Subtasks</p>
        <p className="text-xs text-muted-foreground">{count === 1 ? "1 task" : `${count} tasks`}</p>
      </div>

      {count === 0 ? (
        <p className="text-sm text-muted-foreground">No subtasks yet.</p>
      ) : (
        <ul className="space-y-2">
          {taskIds.map((taskId) => {
            const details = existingDetails(taskId);
            const attached = !savedTaskIds.includes(taskId);
            const fromEvent = taskEventId(taskId);
            const moving = attached && fromEvent != null && fromEvent !== selectedId;
            return (
              <SubtaskRow
                key={`existing-${taskId}`}
                title={details.name}
                detail={
                  moving
                    ? [details.detail, `moves from event #${fromEvent} when you save`]
                        .filter(Boolean)
                        .join(" · ")
                    : details.detail
                }
                badge={attached ? "Attached" : undefined}
                onRemove={
                  readOnly
                    ? undefined
                    : () => onTaskIdsChange(taskIds.filter((id) => id !== taskId))
                }
              />
            );
          })}
          {draftSubtasks.map((subtask) => {
            const assignee =
              members.find((member) => String(member.memberId) === subtask.assigneeId)?.name ??
              "Unassigned";
            const resourceNames = names(
              subtask.resourceIds.map(
                (id) => resources.find((resource) => String(resource.resourceId) === id)?.name,
              ),
            );
            return (
              <SubtaskRow
                key={subtask.key}
                title={subtask.name}
                detail={[
                  assignee,
                  `due ${formatSubtaskDate(subtask.deadline)}`,
                  resourceNames.join(", "),
                ]
                  .filter(Boolean)
                  .join(" · ")}
                badge="New"
                onRemove={readOnly ? undefined : () => onRemoveDraft(subtask.key)}
              />
            );
          })}
        </ul>
      )}

      {!readOnly && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => handleOpenChange(true)}>
              <PlusIcon />
              New subtask
            </Button>
            {/* Picking a task attaches it straight away; the input then clears. */}
            <Combobox
              key={taskIds.join("-") || "none"}
              items={attachOptions}
              value={null as AttachOption | null}
              onValueChange={(option) => {
                if (option && !taskIds.includes(option.id)) {
                  onTaskIdsChange([...taskIds, option.id]);
                }
              }}
              itemToStringLabel={(option) => option.label}
              isItemEqualToValue={(a, b) => a?.id === b?.id}
              filter={(item, query) => fuzzyMatches(item.search, query)}
            >
              <ComboboxInput
                id="event-task"
                aria-label="Attach existing task"
                placeholder="Attach existing task..."
                disabled={attachOptions.length === 0}
                className="min-w-0 flex-1"
              />
              <ComboboxContent>
                <ComboboxEmpty>No tasks match.</ComboboxEmpty>
                <ComboboxList>
                  <ComboboxCollection>
                    {(option: AttachOption) => (
                      <ComboboxItem key={option.id} value={option}>
                        <span className="truncate">{option.label}</span>
                      </ComboboxItem>
                    )}
                  </ComboboxCollection>
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
          <p className="text-xs text-muted-foreground">
            New subtasks and changes are saved when you save the event.
          </p>
        </>
      )}

      {/* Portalled out of the event form, so Enter here never saves the event. */}
      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New subtask</DialogTitle>
            <DialogDescription>
              Added to this event&apos;s list now, created when you save the event.
            </DialogDescription>
          </DialogHeader>

          {/* The id scopes where a failed "Add to event" moves focus to. */}
          <div id="subtask-composer" className="space-y-4 py-2">
            <Field
              id="subtask-title"
              label="Subtask title"
              error={subtaskValidation.errorFor("name")}
            >
              <Input
                id="subtask-title"
                placeholder="e.g. Finish slides for the welcome talk"
                value={subtaskTitle}
                onChange={(e) => onSubtaskTitleChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (onAddDraft()) setDialogOpen(false);
                  }
                }}
                {...subtaskValidation.fieldProps("name", "subtask-title", { touchOnBlur: false })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="subtask-assignee" label="Assignee">
                <OptionSelect
                  id="subtask-assignee"
                  value={subtaskAssigneeId}
                  placeholder="Select a member..."
                  options={memberOptions}
                  onChange={onSubtaskAssigneeIdChange}
                />
              </Field>
              <Field
                id="subtask-deadline"
                label="Due date"
                error={subtaskValidation.errorFor("deadline")}
              >
                <Input
                  id="subtask-deadline"
                  type="date"
                  value={subtaskDeadline}
                  onChange={(e) => onSubtaskDeadlineChange(e.target.value)}
                  {...subtaskValidation.fieldProps("deadline", "subtask-deadline", {
                    touchOnBlur: false,
                  })}
                />
              </Field>
            </div>
            <ResourceSearch
              resources={resources}
              selectedIds={subtaskResourceIds}
              onChange={onSubtaskResourceIdsChange}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            {/* Never disabled: pressing it says what is missing. */}
            <Button
              type="button"
              onClick={() => {
                if (onAddDraft()) setDialogOpen(false);
              }}
            >
              Add to event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
