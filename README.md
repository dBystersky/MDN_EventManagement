# MDN_EventManagement

Event and task management tool for Monash Deep Neuron (MDN).

The whole app lives in [`mdn-event-management/`](./mdn-event-management) — one
Next.js project, frontend and API together.

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Styling | Tailwind CSS v4, shadcn/ui |
| API | Next.js route handlers, TypeScript |
| Database | PostgreSQL via Prisma 7 |
| Auth | JWT in an httpOnly cookie (`jsonwebtoken`, `bcryptjs`) |

## Docs

Start at [docs/](./docs) — [getting-started.md](./docs/getting-started.md) takes
you from clone to running app. The requirement list is
[docs/RTM.md](./docs/RTM.md).
