# mdn-event-management

The Next.js app — UI, API routes, and Prisma schema for the MDN event/task management tool.
Next.js 16, React 19, Tailwind v4 + shadcn/ui, Prisma against PostgreSQL.

Setup and day-to-day commands live in the repo docs:

- [Setup (Docker / podman)](../docs/setup.md) — first-time local setup
- [Updating the DB schema](../docs/database.md) — the Prisma migration workflow
- [Running the test server](../docs/dev-server.md) — start/stop the dev server, run the test suite

UI conventions (shadcn/ui is mandatory) are in [AGENTS.md](./AGENTS.md).

## Scripts

| Command | Does |
|---------|------|
| `npm run dev` | Dev server on http://localhost:3000 |
| `npm run build` | Production build |
| `npm start` | Serve a production build |
| `npm run lint` | ESLint |
| `npm test` | Integration tests — needs `npm run dev` running, see the docs |
