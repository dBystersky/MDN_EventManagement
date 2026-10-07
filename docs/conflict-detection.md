# Clash detection

Requirement 7: *the system shall automatically flag when events are
overlapping/clashing with dates, venues, or assigned resources.*

## The three kinds

| Kind | Means | Severity |
|------|-------|----------|
| `venue` | Two events in one location at the same time | error |
| `resource` | One resource booked twice over the same window | error |
| `schedule` | Two events at the same time sharing no venue or resource | warning |

A `schedule` warning is global and deliberate — two events running at once is
worth knowing about even when nothing is shared, because nobody can staff both.
A pair reported as a `venue` clash is **not** also reported as `schedule`; one
problem gets one flag.

## Two rules that are easy to get wrong

**Intervals are half-open, `[start, end)`.** A booking that ends exactly when the
next begins does *not* clash — back-to-back is the normal way to reuse a room.
`lib/timeline.ts` uses the same convention; if you change one, change both or the
timeline and the badges will disagree about the same data.

**Clashes are flagged, never blocked.** Creates and updates still return
`200`/`201` with a `conflicts` array. A committee that means to run two things at
once should not have to fight the app. The one thing rejected outright is an
inverted date range (`400`), because clash detection drops such ranges and the
booking would otherwise go unchecked.

## Where it lives

| File | Role |
|------|------|
| `lib/conflicts.ts` | The interval maths. Pure — no Prisma, no React, so it is testable without a database |
| `lib/conflictQueries.ts` | The database half: gather rows, call the pure functions, narrow the result |
| `components/conflict-flags.tsx` | `ConflictBadge` and `ConflictAlert`, so a clash reads the same everywhere |

| Endpoint | Use |
|----------|-----|
| `GET /api/conflicts` | Every clash in the system. What the list badges read |
| `POST /api/conflicts/preview` | What an *unsaved* event or booking would clash with. Drives the live form warning |

Event and allocation create/update responses carry their own `conflicts` array,
so a caller sees the consequence of the write it just made.

## One surprise, on purpose

An event and one of its own subtasks holding the same resource inside the event's
span **is** flagged as a `resource` clash. That is one physical item claimed
twice, so flagging it is correct, but it looks odd the first time. Do not suppress
it without deciding that is really what you want.

Tests: `tests/conflicts.test.ts` for the maths, `tests/api/conflicts.test.ts` for
the endpoints.
