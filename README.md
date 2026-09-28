# MDN_EventManagement

[![CI](https://github.com/dBystersky/MDN_EventManagement/actions/workflows/ci.yml/badge.svg)](https://github.com/dBystersky/MDN_EventManagement/actions/workflows/ci.yml)

Event/Task management tool for Monash Deep Neuron (MDN)

Framework: React 19.2.4
Frontend:
- Tailwind CSS v4^
- shadcn

Database (SQL):
- PostgreSQL
- Prisma (ORM)

Backend:
- Typescript
- Express.js
- Node.js

## Local DB setup

See [prisma-notes.md](./prisma-notes.md) — each teammate runs Postgres locally (Docker) and applies migrations with `npx prisma migrate dev`.

## Checks

Every push to `main` and every pull request runs these checks in GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml)). Run them locally from `mdn-event-management/` before pushing:

| Check | Command |
|-------|---------|
| Unit tests | `npm test` (or `npm run test:watch`) |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Format | `npm run format:check` (fix with `npm run format`) |

The unit tests call the API route handlers in `app/api/**/route.ts` directly, with the Prisma client mocked (see `mdn-event-management/tests/setup.ts`), so they need neither Postgres nor `npm run dev`. Run `npx prisma generate` first if you haven't already.
