import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession, type UserSession } from "@/lib/auth";
import type { Actor, EventAccessInfo } from "@/lib/permissions";

/**
 * Server-side enforcement of the role rules in `lib/permissions.ts`. Route
 * handlers call these; the UI only mirrors them.
 */

export const unauthorised = () => NextResponse.json({ error: "Unauthorised" }, { status: 401 });

export const forbidden = (reason = "You do not have permission to do that") =>
  NextResponse.json({ error: `Forbidden — ${reason}` }, { status: 403 });

export function actorOf(session: UserSession): Actor {
  return { role: session.role, memberId: session.member_id };
}

/** The signed-in session, or the 401 to return. */
export async function requireSession(): Promise<
  { session: UserSession; actor: Actor; denied?: undefined } | { denied: NextResponse }
> {
  const session = await getAuthSession();
  if (!session) return { denied: unauthorised() };
  return { session, actor: actorOf(session) };
}

const eventAccessSelect = {
  eventManagers: { select: { memberId: true } },
  eventMembers: { select: { memberId: true } },
} as const;

/** Managers and members of an event, or `null` if there is no such event. */
export async function loadEventAccess(eventId: number): Promise<EventAccessInfo | null> {
  if (!Number.isFinite(eventId)) return null;
  return prisma.event.findUnique({ where: { eventId }, select: eventAccessSelect });
}

/** Same, for the event a task belongs to (`null` for a task with no event). */
export async function loadTaskEventAccess(eventId: number | null): Promise<EventAccessInfo | null> {
  return eventId == null ? null : loadEventAccess(eventId);
}
