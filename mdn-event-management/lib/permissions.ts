/**
 * Role rules, shared by the route handlers and the UI so both agree.
 *
 *   Executive — sees and does everything, and sets budgets everywhere.
 *   Manager   — edits the events they manage (and those events' tasks, budgets included); can view
 *               other events but not change them; assigns Members to events and
 *               people to tasks.
 *   Member    — sees only the events they are attached to; creates tasks there
 *               and updates task status and details.
 *
 * IMPORTANT: the UI uses these to hide controls, but the route handlers
 * (`lib/access.ts`) enforce them — a hidden button stops nobody calling the API.
 * Locations, resources, resource types and allocations are not role-gated.
 */

export type Role = "Member" | "Manager" | "Executive";

export type Capabilities = {
  create: boolean;
  edit: boolean;
  delete: boolean;
};

/** The signed-in person, as far as these rules need to know. */
export type Actor = { role: string | null | undefined; memberId: number | null | undefined };

export const TASK_STATUSES = ["backlog", "ready_to_do", "in_progress", "blocked", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  ready_to_do: "Ready to do",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
};

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && (TASK_STATUSES as readonly string[]).includes(value);
}

type WithMember = { memberId: number }[];
/** The slice of an event that decides who may touch it. */
export type EventAccessInfo = { eventManagers?: WithMember; eventMembers?: WithMember };
/** The slice of a task that decides who may touch it. */
export type TaskAccessInfo = { taskManagers?: WithMember };

const FULL_ACCESS: Capabilities = { create: true, edit: true, delete: true };

export const isExecutive = (a: Actor) => a.role === "Executive";
export const isManager = (a: Actor) => a.role === "Manager";
export const isMember = (a: Actor) => a.role === "Member";

function listed(list: WithMember | undefined, a: Actor) {
  return a.memberId != null && !!list?.some((m) => m.memberId === a.memberId);
}

/** Executives and Managers see every event; Members only the ones they belong to. */
export function canViewEvent(a: Actor, event: EventAccessInfo): boolean {
  if (isExecutive(a) || isManager(a)) return true;
  return isMember(a) && listed(event.eventMembers, a);
}

/** Executives, and the Managers assigned to this event. */
export function canModifyEvent(a: Actor, event: EventAccessInfo): boolean {
  return isExecutive(a) || (isManager(a) && listed(event.eventManagers, a));
}

/** Creating or deleting an event, and choosing its managers, is Executive-only. */
export function canCreateEvent(a: Actor): boolean {
  return isExecutive(a);
}

/** Executives and Managers set budgets (a Manager only where they can edit the task). */
export function canEditBudget(a: Actor): boolean {
  return isExecutive(a) || isManager(a);
}

/** Executives, and Managers for an event they manage; may add or remove Members. */
export function canAssignEventMembers(a: Actor, event: EventAccessInfo): boolean {
  return canModifyEvent(a, event);
}

/**
 * Who may see a task. `event` is the task's event, or `null` for a task that
 * belongs to none. Members also see tasks they are personally assigned to.
 */
export function canViewTask(
  a: Actor,
  task: TaskAccessInfo,
  event: EventAccessInfo | null,
): boolean {
  if (isExecutive(a) || isManager(a)) return true;
  if (!isMember(a)) return false;
  return listed(task.taskManagers, a) || (event != null && listed(event.eventMembers, a));
}

/** Full edit/delete/assign rights over a task: Executives, and Managers of its event. */
export function canModifyTask(a: Actor, event: EventAccessInfo | null): boolean {
  if (isExecutive(a)) return true;
  if (!isManager(a)) return false;
  // A task with no event isn't "within" anyone else's event, so Managers keep it.
  return event == null || canModifyEvent(a, event);
}

/** Status and details (name, description, deadline) — Members included. */
export function canUpdateTaskDetails(
  a: Actor,
  task: TaskAccessInfo,
  event: EventAccessInfo | null,
): boolean {
  return canModifyTask(a, event) || (isMember(a) && canViewTask(a, task, event));
}

/** Creating a task in `event` (`null` = no event). Members need to belong to it. */
export function canCreateTask(a: Actor, event: EventAccessInfo | null): boolean {
  if (isExecutive(a)) return true;
  if (isManager(a)) return event == null || canModifyEvent(a, event);
  return isMember(a) && event != null && listed(event.eventMembers, a);
}

// The pages below are not role-gated (see header), so these stay open. They
// remain per-page so the UI has one place to tighten each later.
type RoleCapabilities = (role?: string | null) => Capabilities;
const open: RoleCapabilities = () => FULL_ACCESS;
export const resourcePermissions = open;
export const resourceTypePermissions = open;
export const allocationPermissions = open;
export const locationPermissions = open;

/**
 * The audit trail is always restricted (not behind `ENFORCED`): it records who
 * did what, so only executives see it.
 */
export function canViewAuditLog(role: string | null | undefined): boolean {
  return role === "Executive";
}

/**
 * Reads the current member from the session endpoint. Returns `null` for
 * anonymous visitors — `/api/auth/me` answers 401 when there is no cookie, and
 * `apiJson` would throw on that, so this deliberately uses a plain `fetch`.
 */
export async function fetchSession(): Promise<Actor | null> {
  try {
    const res = await fetch("/api/auth/me");
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.user) return null;
    return { role: json.user.role ?? null, memberId: json.user.member_id ?? null };
  } catch {
    return null;
  }
}

export async function fetchSessionRole(): Promise<string | null> {
  return (await fetchSession())?.role ?? null;
}
