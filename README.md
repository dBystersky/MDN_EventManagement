# MDN_EventManagement
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

## Docs

- [Setup (Docker / podman)](./docs/setup.md) — first-time local setup: Postgres container, `.env`, migrations
- [Updating the DB schema](./docs/database.md) — the Prisma migration workflow
- [Running the test server](./docs/dev-server.md) — start/stop the dev server, run the test suite

## Quickstart

Already set up? Start the two servers:

```bash
docker start mdn-postgres        # or: podman start mdn-postgres
cd mdn-event-management && npm run dev
```
