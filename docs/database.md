# Updating the DB schema

The database is PostgreSQL, accessed through [Prisma](https://www.prisma.io/). The schema
lives in `mdn-event-management/prisma/schema.prisma` and every change to it is committed as a
migration in `mdn-event-management/prisma/migrations/`.

All commands below run from `mdn-event-management/`.

If the database itself won't start, that's [setup.md](./setup.md), not this doc.

## Command reference

| Task | Command |
|------|---------|
| Apply pending migrations | `npx prisma migrate dev` |
| Create a migration from your schema edits | `npx prisma migrate dev --name <short_description>` |
| Check what's applied vs pending | `npx prisma migrate status` |
| Regenerate Prisma Client | `npx prisma generate` |
| Browse / edit data in a GUI | `npx prisma studio` |
| Reset DB — wipes data, re-applies migrations | `npx prisma migrate reset` |

## When you change the schema

1. Edit `prisma/schema.prisma`.
2. Create the migration:

   ```bash
   npx prisma migrate dev --name add_task_budget
   ```

   This writes a new folder under `prisma/migrations/`, applies it to your local DB, and
   regenerates the client.
3. Commit **both** the changed `schema.prisma` **and** the new `prisma/migrations/<timestamp>_<name>/`
   folder. A migration that isn't committed doesn't exist for anyone else.
4. Tell the team, so they run step 1 of the next section after pulling.

Name migrations in `snake_case` and describe the change, matching the existing ones:
`init`, `member_email_unique`, `add_task_budget_and_event_total`.

## When you pull someone else's migration

```bash
npx prisma migrate dev      # applies anything new to your local DB
```

If your editor still shows stale Prisma types afterwards:

```bash
npx prisma generate
```

The client is generated to `generated/prisma` (set by the `output` in `schema.prisma`), not
into `node_modules`. It is not committed, so a fresh clone must run `generate` at least once —
`npm install` and `migrate dev` both do it for you.

## Troubleshooting

**`Environment variable not found: DATABASE_URL`** — `.env` is missing or wasn't copied from
`.env.example`. `prisma.config.ts` loads it via `dotenv/config` and the schema has no
fallback URL. See [setup.md](./setup.md) step 3.

**`Can't reach database server at localhost:5433`** — the container is stopped. Check
`docker ps -a` / `podman ps -a`, then `docker start mdn-postgres`.

**Drift detected / a migration failed halfway** — your local DB no longer matches the
migration history. The fix is:

```bash
npx prisma migrate reset     # ⚠️ wipes all local data, then re-applies every migration
```

This is safe and routine here — the local DB holds only your own test data. Do not "fix" drift
by hand-editing an already-committed migration; add a new one instead.

**Pending migrations you didn't expect** — run `npx prisma migrate status` to see exactly
which ones, then `npx prisma migrate dev`.
