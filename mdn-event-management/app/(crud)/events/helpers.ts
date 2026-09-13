import type { EventItem, Member, Option, Resource, Task } from "./types";

export function toDatetimeLocal(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function formatEventDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatSubtaskDate(value: string) {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function names(values: Array<string | undefined | null>) {
  return values.filter((value): value is string => Boolean(value));
}

export function resourceLabel(resource?: Resource | null) {
  if (!resource) return "Unknown";
  return resource.resourceTypeRel?.name
    ? `${resource.name} · ${resource.resourceTypeRel.name}`
    : resource.name;
}

/** Keep labels for IDs that are assigned but missing from the live catalog. */
export function orphanOptions<T>(
  extras: T[] | undefined,
  isKnown: (item: T) => boolean,
  toOption: (item: T) => Option | null,
): Option[] {
  return (extras ?? []).flatMap((item) => {
    if (isKnown(item)) return [];
    const option = toOption(item);
    return option ? [option] : [];
  });
}

export function managerNamesFor(ev: EventItem, members: Member[]) {
  return names(
    (ev.eventManagers ?? []).map(
      (em) =>
        em.member?.name ??
        members.find((member) => member.memberId === em.memberId)?.name,
    ),
  );
}

export function resourceNamesFor(ev: EventItem, resources: Resource[]) {
  return names(
    (ev.bookable?.resourceAllocations ?? []).map(
      (allocation) =>
        allocation.resource?.name ??
        resources.find((resource) => resource.resourceId === allocation.resourceId)
          ?.name,
    ),
  );
}

export function existingSubtaskDetails(
  taskId: string,
  selectedEvent: EventItem | undefined,
  allTasks: Task[],
) {
  const fromEvent = selectedEvent?.tasks?.find(
    (task) => String(task.taskId) === taskId,
  );
  const fromCatalog = allTasks.find((task) => String(task.taskId) === taskId);
  const assignees = names(
    (fromEvent?.taskManagers ?? fromCatalog?.taskManagers ?? []).map(
      (tm) => tm.member?.name,
    ),
  );
  const assignedResources = names(
    (fromEvent?.bookable?.resourceAllocations ?? []).map(
      (allocation) => allocation.resource?.name,
    ),
  );
  const deadline = fromEvent?.deadline ?? fromCatalog?.deadline;

  return {
    name: fromEvent?.name ?? fromCatalog?.name ?? `Task #${taskId}`,
    detail: [
      assignees.join(", ") || "Unassigned",
      deadline ? `due ${formatSubtaskDate(deadline)}` : "",
      assignedResources.join(", "),
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

export function managerPickerOptions(
  members: Member[],
  selectedEvent: EventItem | undefined,
): Option[] {
  return [
    ...members.map((member) => ({
      id: String(member.memberId),
      label: member.name,
    })),
    ...orphanOptions(
      selectedEvent?.eventManagers,
      (em) => members.some((member) => member.memberId === em.memberId),
      (em) =>
        em.member?.name ? { id: String(em.memberId), label: em.member.name } : null,
    ),
  ];
}

export function resourcePickerOptions(
  resources: Resource[],
  selectedEvent: EventItem | undefined,
): Option[] {
  return [
    ...resources.map((resource) => ({
      id: String(resource.resourceId),
      label: resource.name,
    })),
    ...orphanOptions(
      selectedEvent?.bookable?.resourceAllocations,
      (allocation) =>
        resources.some((resource) => resource.resourceId === allocation.resourceId),
      (allocation) =>
        allocation.resource?.name
          ? { id: String(allocation.resourceId), label: allocation.resource.name }
          : null,
    ),
  ];
}

export function taskPickerOptions(
  allTasks: Task[],
  selectedEvent: EventItem | undefined,
  selectedId: number | null,
): Option[] {
  return [
    ...allTasks.map((task) => ({
      id: String(task.taskId),
      label:
        task.eventId && task.eventId !== selectedId
          ? `${task.name} (event #${task.eventId})`
          : task.name,
    })),
    ...orphanOptions(
      selectedEvent?.tasks,
      (task) => allTasks.some((item) => item.taskId === task.taskId),
      (task) => ({ id: String(task.taskId), label: task.name }),
    ),
  ];
}
