"use client";

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
import { Textarea } from "@/components/ui/textarea";

import { ConflictAlert } from "@/components/conflict-flags";
import type { FieldValidation } from "@/hooks/use-field-validation";
import type { Conflict } from "@/lib/conflicts";
import { isInPast, type EventField, type SubtaskDraftField } from "@/lib/validation";

import { EventSubtasks } from "./event-subtasks";
import { AssignmentPicker, Field, OptionSelect } from "./form-controls";
import type { DraftSubtask, Member, Option, Resource } from "./types";

export function EventForm({
  isEditing,
  selectedId,
  name,
  onNameChange,
  description,
  onDescriptionChange,
  date,
  onDateChange,
  endDate,
  onEndDateChange,
  conflicts,
  validation,
  subtaskValidation,
  locationId,
  onLocationIdChange,
  locationOptions,
  managerIds,
  onManagerIdsChange,
  managerPickerOptions,
  resourceIds,
  onResourceIdsChange,
  resourcePickerOptions,
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
  onCancel,
  onSubmit,
}: {
  isEditing: boolean;
  selectedId: number | null;
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  date: string;
  onDateChange: (value: string) => void;
  endDate: string;
  onEndDateChange: (value: string) => void;
  /** What this event as drafted would clash with; empty when nothing does. */
  conflicts: readonly Conflict[];
  validation: FieldValidation<EventField>;
  subtaskValidation: FieldValidation<SubtaskDraftField>;
  locationId: string;
  onLocationIdChange: (value: string) => void;
  locationOptions: Option[];
  managerIds: string[];
  onManagerIdsChange: (ids: string[]) => void;
  managerPickerOptions: Option[];
  resourceIds: string[];
  onResourceIdsChange: (ids: string[]) => void;
  resourcePickerOptions: Option[];
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
  onCancel: () => void;
  onSubmit: (form: HTMLFormElement) => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Update event" : "Event details"}</CardTitle>
        <CardDescription>
          {isEditing
            ? "Change the selected event, then save."
            : "Name the event, add a brief, then pick a time and venue."}
        </CardDescription>
      </CardHeader>
      {/* noValidate: the inline errors below replace the browser's bubbles. */}
      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          await onSubmit(e.currentTarget);
        }}
      >
        <CardContent className="space-y-4 pb-4">
          <Field id="event-name" label="Event name" error={validation.errorFor("name")}>
            <Input
              id="event-name"
              placeholder="Name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              required
              {...validation.fieldProps("name", "event-name")}
            />
          </Field>
          <Field id="event-description" label="Description">
            <Textarea
              id="event-description"
              placeholder="Description"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="event-date"
              label="Starts"
              error={validation.errorFor("date")}
              hint={isInPast(date) ? "This is in the past." : undefined}
            >
              <Input
                id="event-date"
                type="datetime-local"
                value={date}
                onChange={(e) => onDateChange(e.target.value)}
                required
                {...validation.fieldProps("date", "event-date")}
              />
            </Field>
            {/* An event needs a real span, not just a start: clash detection has
                nothing to compare without one. Prefilled to two hours after the
                start, which is only a default. */}
            <Field id="event-end-date" label="Ends" error={validation.errorFor("endDate")}>
              <Input
                id="event-end-date"
                type="datetime-local"
                value={endDate}
                min={date || undefined}
                onChange={(e) => onEndDateChange(e.target.value)}
                required
                {...validation.fieldProps("endDate", "event-end-date")}
              />
            </Field>
          </div>
          {/* Its own row rather than a lone cell in a two-column grid, which
              would leave the select stranded at half width. */}
          <div>
            <Field
              id="event-location"
              label="Location"
              error={validation.errorFor("locationId")}
            >
              <OptionSelect
                id="event-location"
                value={locationId}
                placeholder="Location..."
                options={locationOptions}
                onChange={onLocationIdChange}
                validation={validation.fieldProps("locationId", "event-location")}
              />
            </Field>
          </div>
          <AssignmentPicker
            key={`managers-${selectedId ?? "new"}`}
            id="event-manager"
            label="Event managers"
            placeholder="Select a member..."
            selectedIds={managerIds}
            onChange={onManagerIdsChange}
            options={managerPickerOptions}
          />
          <AssignmentPicker
            key={`resources-${selectedId ?? "new"}`}
            id="event-resource"
            label="Resources"
            placeholder="Select a resource..."
            selectedIds={resourceIds}
            onChange={onResourceIdsChange}
            options={resourcePickerOptions}
          />
          <EventSubtasks
            selectedId={selectedId}
            taskIds={taskIds}
            onTaskIdsChange={onTaskIdsChange}
            taskPickerOptions={taskPickerOptions}
            draftSubtasks={draftSubtasks}
            onRemoveDraft={onRemoveDraft}
            subtaskTitle={subtaskTitle}
            onSubtaskTitleChange={onSubtaskTitleChange}
            subtaskAssigneeId={subtaskAssigneeId}
            onSubtaskAssigneeIdChange={onSubtaskAssigneeIdChange}
            subtaskDeadline={subtaskDeadline}
            onSubtaskDeadlineChange={onSubtaskDeadlineChange}
            subtaskValidation={subtaskValidation}
            subtaskResourceIds={subtaskResourceIds}
            onSubtaskResourceIdsChange={onSubtaskResourceIdsChange}
            memberOptions={memberOptions}
            members={members}
            resources={resources}
            onAddDraft={onAddDraft}
            existingDetails={existingDetails}
          />
          <ConflictAlert
            conflicts={conflicts}
            hint="Clashes are flagged, not blocked — you can still save this event."
          />
        </CardContent>
        <CardFooter className="justify-end gap-2">
          {isEditing && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit">{isEditing ? "Update" : "Create"}</Button>
        </CardFooter>
      </form>
    </Card>
  );
}
