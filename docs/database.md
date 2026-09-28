# Database

Postgres + Prisma. Everyone runs their own local database on port 5433; there is
no shared instance. First-time setup is in
[getting-started.md](./getting-started.md).

All commands run from `mdn-event-management/`.

## Day to day

| Task | Command |
|------|---------|
| Apply new migrations after a pull | `npx prisma migrate dev` |
| Check whether you are behind | `npx prisma migrate status` |
| Regenerate the client | `npx prisma generate` |
| Browse and edit data | `npx prisma studio` |
| Wipe and rebuild (destroys data) | `npx prisma migrate reset` |
| Recreate the admin account | `npx prisma db seed` |

`generated/prisma` is gitignored. If TypeScript cannot see a model that is
plainly in `schema.prisma`, you need `generate`.

## Changing the schema

1. Edit `prisma/schema.prisma`.
2. `npx prisma migrate dev --name short_description`
3. Commit **both** `schema.prisma` and the new folder under
   `prisma/migrations/`. A migration without its schema change, or vice versa,
   breaks everyone else.
4. Teammates pull, then run `npx prisma migrate dev`.

## When the generated SQL would lose data

`migrate dev` writes the migration for you, but it does not know your intent. A
generated migration will happily drop a column or fail outright — adding a
`NOT NULL` column to a table that already has rows is the common case, because
there is no value for the existing ones.

When that applies, write the SQL yourself:

```bash
npx prisma migrate dev --create-only --name add_thing
# edit prisma/migrations/<timestamp>_add_thing/migration.sql
npx prisma migrate dev
```

The pattern for a new required column is three steps — add it nullable, backfill
it, then add the constraint:

```sql
ALTER TABLE "events" ADD COLUMN "end_date" TIMESTAMPTZ;
UPDATE "events" SET "end_date" = "date" + INTERVAL '2 hours';
ALTER TABLE "events" ALTER COLUMN "end_date" SET NOT NULL;
```

`20260927120000_add_event_end_date` is a worked example. Test a migration like
that against a copy with rows in it before pushing — a clean database will not
exercise the backfill.

## Checking the container is alive

```bash
docker exec mdn-postgres psql -U app_user -d event_management \
  -c "SELECT current_user, current_database();"
```

Expect `app_user | event_management`.
