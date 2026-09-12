"use client";

import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { AssignmentPicker, Field, OptionSelect } from "./form-controls";
import { formatSubtaskDate, names } from "./helpers";
import { ResourceSearch } from "./resource-search";
import type { DraftSubtask, Member, Option, Resource } from "./types";

function SubtaskRow({
  title,
  detail,
  onRemove,
}: {
  title: string;
  detail: string;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border bg-background p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        aria-label={`Remove ${title}`}
        onClick={onRemove}
      >
        <XIcon />
      </Button>
    </li>
  );
}

export function EventSubtasks({
  selectedId,
  taskIds,
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
  subtaskResourceIds,
  onSubtaskResourceIdsChange,
  memberOptions,
  members,
  resources,
  onAddDraft,
  existingDetails,
}: {
  selectedId: number | null;
  taskIds: string[];
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
  subtaskResourceIds: string[];
  onSubtaskResourceIdsChange: (ids: string[]) => void;
  memberOptions: Option[];
  members: Member[];
  resources: Resource[];
  onAddDraft: () => void;
  existingDetails: (taskId: string) => { name: string; detail: string };
}) {
  return (
    <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-medium">Event subtasks</p>
        <p className="text-xs text-muted-foreground">
          Create assignments scoped to this event.
        </p>
      </div>

      {/* Selected tasks are listed below, not as picker badges. */}
      <AssignmentPicker
        key={`tasks-${selectedId ?? "new"}`}
        id="event-task"
        label="Attach existing task"
        placeholder="Select a task..."
        showSelected={false}
        selectedIds={taskIds}
        onChange={onTaskIdsChange}
        options={taskPickerOptions}
      />

      <Field id="subtask-title" label="Subtask title">
        <Input
          id="subtask-title"
          placeholder="e.g. Finish slides for the welcome talk"
          value={subtaskTitle}
          onChange={(e) => onSubtaskTitleChange(e.target.value)}
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
        <Field id="subtask-deadline" label="Due date">
          <Input
            id="subtask-deadline"
            type="date"
            value={subtaskDeadline}
            onChange={(e) => onSubtaskDeadlineChange(e.target.value)}
          />
        </Field>
      </div>
      <ResourceSearch
        resources={resources}
        selectedIds={subtaskResourceIds}
        onChange={onSubtaskResourceIdsChange}
      />
      <div className="flex justify-end">
        <Button
          type="button"
          disabled={!subtaskTitle.trim() || !subtaskDeadline}
          onClick={onAddDraft}
        >
          Add subtask
        </Button>
      </div>

      {taskIds.length === 0 && draftSubtasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No subtasks yet. Break this event into concrete assignments above.
        </p>
      ) : (
        <ul className="space-y-2">
          {taskIds.map((taskId) => {
            const details = existingDetails(taskId);
            return (
              <SubtaskRow
                key={`existing-${taskId}`}
                title={details.name}
                detail={details.detail}
                onRemove={() =>
                  onTaskIdsChange(taskIds.filter((id) => id !== taskId))
                }
              />
            );
          })}
          {draftSubtasks.map((subtask) => {
            const assignee =
              members.find(
                (member) => String(member.memberId) === subtask.assigneeId,
              )?.name ?? "Unassigned";
            const resourceNames = names(
              subtask.resourceIds.map(
                (id) =>
                  resources.find((resource) => String(resource.resourceId) === id)
                    ?.name,
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
                onRemove={() => onRemoveDraft(subtask.key)}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
