# Architecture

Next.js 16 (App Router) + React 19 + Tailwind v4 + shadcn/ui, with Prisma 7 over
Postgres. All of it is one Next app in `mdn-event-management/` — there is no
separate backend service.

## Where code goes

| Layer | Path | Job |
|-------|------|-----|
| Pages | `app/(crud)/*/page.tsx` | Client components. Fetch through `lib/api-json.ts`, hold form state, render shadcn parts |
| API | `app/api/*/route.ts` | Thin. Parse the body, call one `lib/` function, map errors to status codes |
| Logic | `lib/*.ts` | The real work, including every Prisma query |
| Client | `lib/prisma.ts` | The single `PrismaClient`; import it, never construct one |

Keep route handlers thin. If a handler is making decisions, that belongs in
`lib/`, where it can be reached from tests and from other routes.

Some `lib/` modules are deliberately **pure** — no React, no Prisma — so the
fiddly maths is testable without a database or a server: `lib/timeline.ts`
(timeline geometry) and `lib/conflicts.ts` (clash intervals). When you add logic
that is easy to get subtly wrong, follow that split. `lib/conflictQueries.ts` is
the pattern for the database half.

## Data model

`Bookable` is the one piece that surprises people. A resource can be booked for
an event *or* a task, so rather than give `ResourceAllocation` two nullable
foreign keys, every event and every task owns exactly one `Bookable` row, and
bookings point at that.

```
Member ──< EventManager >── Event ──> Location
   │                          │
   └──< TaskManager >── Task  │        Event 1─1 Bookable
                        │     │        Task  1─1 Bookable
                        └─────┘                  │
              (Task.eventId, optional)           │
                                                 v
                    Resource ──> ResourceType    │
                        │                         │
                        └──< ResourceAllocation >─┘
                              (startTime, endTime)
```

Worth knowing:

- **Events have a real span.** `date` and `endDate` (both required). An event's
  resource bookings run for exactly that span.
- **Tasks have a `deadline`, not a span.** A task's bookings get a default
  two-hour window around it, and shift with the deadline when it moves.
- **`Event.totalBudget` is a rollup**, not a source of truth — it is the sum of
  its tasks' budgets, recalculated by `recalculateEventTotalBudget` in
  `lib/events.ts`. Change a task budget through `lib/`, never with a raw update,
  or the total drifts.

## Auth

`middleware.ts` guards every route except `/login`, `/signup`, `/api/auth/login`
and `/api/auth/logout`. Pages redirect to `/login`; API routes answer `401`.

The session is a JWT in an httpOnly `mdn_auth_token` cookie, signed and read by
`lib/auth.ts`. Server code gets the current user from `getAuthSession()`.

Accounts are created by an admin (`/members`, backed by `/api/admin/members`) or
by the seed script. `/signup` redirects to `/login` — self-signup is off.

## Known gaps

Two things look done but are not, so do not rely on them:

- **Roles are not enforced.** `lib/permissions.ts` has `ENFORCED = false`, so
  everyone gets full access. It only greys out buttons; it stops nobody from
  calling the API directly. Real enforcement means route handlers checking
  `getAuthSession()` server-side.
- **The `Member`/`Manager`/`Admin` enum exists** in the schema and rides in the
  token, but nothing reads it for authorisation yet.
