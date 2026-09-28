"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleAlertIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { apiJson } from "@/lib/api-json";
import { conflictsByEvent, type Conflict } from "@/lib/conflicts";
import { EventForm } from "./event-form";
import { EventList } from "./event-list";
import {
  existingSubtaskDetails,
  managerPickerOptions,
  resourcePickerOptions,
  taskPickerOptions,
  toDatetimeLocal,
} from "./helpers";
import type { DraftSubtask, EventItem, Location, Member, Resource, Task } from "./types";
import { defaultEndFor } from "@/lib/datetime";

export default function Events() {
  const [items, setItems] = useState<EventItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [error, setError] = useState("");
  /** Every clash in the system, for the badges on the list. */
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  /**
   * The last answered clash check, tagged with the form state it was asked for.
   * Tagging is what keeps a slow reply for an earlier keystroke from surfacing
   * against a newer one.
   */
  const [checked, setChecked] = useState<{ key: string; conflicts: Conflict[] } | null>(
    null,
  );

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [locationId, setLocationId] = useState("");
  const [managerIds, setManagerIds] = useState<string[]>([]);
  const [resourceIds, setResourceIds] = useState<string[]>([]);
  const [taskIds, setTaskIds] = useState<string[]>([]);
  const [draftSubtasks, setDraftSubtasks] = useState<DraftSubtask[]>([]);

  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [subtaskAssigneeId, setSubtaskAssigneeId] = useState("");
  const [subtaskDeadline, setSubtaskDeadline] = useState("");
  const [subtaskResourceIds, setSubtaskResourceIds] = useState<string[]>([]);

  const isEditing = selectedId != null;
  const selectedEvent = items.find((ev) => ev.eventId === selectedId);
  const memberOptions = members.map((member) => ({
    id: String(member.memberId),
    label: member.name,
  }));
  const locationOptions = locations.map((location) => ({
    id: String(location.locationId),
    label: location.name,
  }));

  async function refresh() {
    const [events, locs, tasks, memberList, resourceList, conflictList] =
      await Promise.all([
        apiJson("/api/events"),
        apiJson("/api/locations"),
        apiJson("/api/tasks"),
        apiJson("/api/members"),
        apiJson("/api/resources"),
        apiJson("/api/conflicts"),
      ]);
    setItems(events);
    setLocations(locs);
    setAllTasks(tasks);
    setMembers(memberList);
    setResources(resourceList);
    setConflicts(conflictList);
  }

  /** eventId → its clashes, so the list can badge a row without a scan. */
  const conflictIndex = useMemo(() => conflictsByEvent(conflicts), [conflicts]);

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, []);

  /**
   * The event as currently drafted, or null while it is still incomplete.
   *
   * The event name is deliberately left out: it only changes the wording of a
   * message, and including it would re-query on every letter typed.
   */
  const candidate = useMemo(() => {
    const start = new Date(date);
    const end = new Date(endDate);
    if (
      !locationId ||
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      return null;
    }
    return {
      kind: "event" as const,
      date: start.toISOString(),
      endDate: end.toISOString(),
      locationId: Number(locationId),
      resourceIds: resourceIds.map(Number),
      excludeEventId: selectedId ?? undefined,
    };
  }, [date, endDate, locationId, resourceIds, selectedId]);

  const candidateKey = candidate ? JSON.stringify(candidate) : null;

  /**
   * Clash check as the form is filled in, not only on submit — RTM Req 9 as
   * well as Req 7.
   */
  useEffect(() => {
    if (!candidate || !candidateKey) return;
    const timer = window.setTimeout(() => {
      apiJson("/api/conflicts/preview", "POST", candidate)
        .then((found: Conflict[]) => setChecked({ key: candidateKey, conflicts: found }))
        // A failed check must not read as "no clashes found": leave the previous
        // answer in place rather than claiming the draft is clear.
        .catch(() => undefined);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [candidate, candidateKey]);

  /**
   * Only ever the clashes computed for exactly this draft. Derived, so an
   * incomplete form or an in-flight check shows nothing rather than a stale
   * answer.
   */
  const draftConflicts =
    candidateKey && checked?.key === candidateKey ? checked.conflicts : [];

  /** Picking a start fills in an end two hours later, unless one is already set. */
  function changeDate(value: string) {
    setDate(value);
    if (!endDate) setEndDate(defaultEndFor(value));
  }

  function clearSubtaskComposer() {
    setDraftSubtasks([]);
    setSubtaskTitle("");
    setSubtaskAssigneeId("");
    setSubtaskDeadline("");
    setSubtaskResourceIds([]);
  }

  function resetForm() {
    setSelectedId(null);
    setName("");
    setDescription("");
    setDate("");
    setEndDate("");
    setLocationId("");
    setManagerIds([]);
    setResourceIds([]);
    setTaskIds([]);
    clearSubtaskComposer();
  }

  function selectEvent(ev: EventItem) {
    setSelectedId(ev.eventId);
    setName(ev.name);
    setDescription(ev.description ?? "");
    setDate(toDatetimeLocal(ev.date));
    setEndDate(toDatetimeLocal(ev.endDate));
    setLocationId(ev.location?.locationId != null ? String(ev.location.locationId) : "");
    setManagerIds((ev.eventManagers ?? []).map((em) => String(em.memberId)));
    setResourceIds(
      (ev.bookable?.resourceAllocations ?? []).map((allocation) =>
        String(allocation.resourceId),
      ),
    );
    setTaskIds((ev.tasks ?? []).map((task) => String(task.taskId)));
    clearSubtaskComposer();
    setError("");
  }

  function addDraftSubtask() {
    const title = subtaskTitle.trim();
    if (!title || !subtaskDeadline) return;
    setDraftSubtasks((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        name: title,
        assigneeId: subtaskAssigneeId,
        deadline: subtaskDeadline,
        resourceIds: subtaskResourceIds,
      },
    ]);
    setSubtaskTitle("");
    setSubtaskAssigneeId("");
    setSubtaskDeadline("");
    setSubtaskResourceIds([]);
  }

  async function saveEvent() {
    const payload = {
      name,
      description,
      date: new Date(date).toISOString(),
      endDate: new Date(endDate).toISOString(),
      locationId: Number(locationId),
      managerIds: managerIds.map(Number),
      resourceIds: resourceIds.map(Number),
      taskIds: taskIds.map(Number),
      subtasks: draftSubtasks.map((subtask) => ({
        name: subtask.name,
        deadline: new Date(subtask.deadline).toISOString(),
        managerIds: subtask.assigneeId ? [Number(subtask.assigneeId)] : [],
        resourceIds: subtask.resourceIds.map(Number),
      })),
    };

    if (isEditing) {
      selectEvent(await apiJson(`/api/events/${selectedId}`, "PATCH", payload));
    } else {
      await apiJson("/api/events", "POST", payload);
      resetForm();
    }
    await refresh();
  }

  async function deleteEvent(eventId: number) {
    await apiJson(`/api/events/${eventId}`, "DELETE");
    if (selectedId === eventId) resetForm();
    await refresh();
  }

  return (
    <section>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold">
            Events
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
          <EventForm
            isEditing={isEditing}
            selectedId={selectedId}
            name={name}
            onNameChange={setName}
            description={description}
            onDescriptionChange={setDescription}
            date={date}
            onDateChange={changeDate}
            endDate={endDate}
            onEndDateChange={setEndDate}
            conflicts={draftConflicts}
            locationId={locationId}
            onLocationIdChange={setLocationId}
            locationOptions={locationOptions}
            managerIds={managerIds}
            onManagerIdsChange={setManagerIds}
            managerPickerOptions={managerPickerOptions(members, selectedEvent)}
            resourceIds={resourceIds}
            onResourceIdsChange={setResourceIds}
            resourcePickerOptions={resourcePickerOptions(resources, selectedEvent)}
            taskIds={taskIds}
            onTaskIdsChange={setTaskIds}
            taskPickerOptions={taskPickerOptions(allTasks, selectedEvent, selectedId)}
            draftSubtasks={draftSubtasks}
            onRemoveDraft={(key) =>
              setDraftSubtasks((current) => current.filter((item) => item.key !== key))
            }
            subtaskTitle={subtaskTitle}
            onSubtaskTitleChange={setSubtaskTitle}
            subtaskAssigneeId={subtaskAssigneeId}
            onSubtaskAssigneeIdChange={setSubtaskAssigneeId}
            subtaskDeadline={subtaskDeadline}
            onSubtaskDeadlineChange={setSubtaskDeadline}
            subtaskResourceIds={subtaskResourceIds}
            onSubtaskResourceIdsChange={setSubtaskResourceIds}
            memberOptions={memberOptions}
            members={members}
            resources={resources}
            onAddDraft={addDraftSubtask}
            existingDetails={(taskId) =>
              existingSubtaskDetails(taskId, selectedEvent, allTasks)
            }
            onCancel={resetForm}
            onSubmit={async () => {
              setError("");
              try {
                await saveEvent();
              } catch (err) {
                setError(String(err));
              }
            }}
          />
          <EventList
            items={items}
            selectedId={selectedId}
            members={members}
            conflictsFor={(eventId) => conflictIndex.get(eventId) ?? []}
            onSelect={selectEvent}
            onDelete={async (eventId) => {
              setError("");
              try {
                await deleteEvent(eventId);
              } catch (err) {
                setError(String(err));
              }
            }}
          />
        </div>
      </div>
    </section>
  );
}
