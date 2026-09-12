"use client";

import { useEffect, useState } from "react";
import { CircleAlertIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { apiJson } from "../api";
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

export default function Events() {
  const [items, setItems] = useState<EventItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
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
    const [events, locs, tasks, memberList, resourceList] = await Promise.all([
      apiJson("/api/events"),
      apiJson("/api/locations"),
      apiJson("/api/tasks"),
      apiJson("/api/members"),
      apiJson("/api/resources"),
    ]);
    setItems(events);
    setLocations(locs);
    setAllTasks(tasks);
    setMembers(memberList);
    setResources(resourceList);
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, []);

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
    <section className="relative left-1/2 w-screen -translate-x-1/2 -my-8 min-h-[calc(100vh-3.25rem)] bg-linear-to-b from-primary from-0% via-primary via-[45%] to-secondary px-6 py-8 md:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <h1 className="font-heading text-3xl font-medium tracking-tight text-primary-foreground">
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
            onDateChange={setDate}
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
            resources={resources}
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
