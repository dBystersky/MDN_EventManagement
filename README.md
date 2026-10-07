# MDN_EventManagement

[![CI](https://github.com/dBystersky/MDN_EventManagement/actions/workflows/ci.yml/badge.svg)](https://github.com/dBystersky/MDN_EventManagement/actions/workflows/ci.yml)

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

## Checks

Every push to `main` and every pull request runs these checks in GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)). Run them locally from `mdn-event-management/` before pushing:

| Check | Command |
|-------|---------|
| Unit tests | `npm test` (or `npm run test:watch`) |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Format | `npm run format:check` (fix with `npm run format`) |

The unit tests call the API route handlers in `app/api/**/route.ts` directly, with the Prisma client mocked (see `mdn-event-management/tests/setup.ts`), so they need neither Postgres nor `npm run dev`. Run `npx prisma generate` first if you haven't already.
