# Local database setup (PostgreSQL + Prisma)

Everyone runs **their own local Postgres**. There is no shared team database.
After cloning, each person must start Postgres, set `.env`, install deps, and **run migrations** so their DB matches `schema.prisma`.

## One-time setup

### 1. Start Docker Desktop

This project’s recommended local DB is Postgres in Docker (port `5433`).

### 2. Create the Postgres container (first time only)

```bash
docker run --name mdn-postgres `
  -e POSTGRES_USER=app_user `
  -e POSTGRES_PASSWORD=app_password `
  -e POSTGRES_DB=event_management `
  -p 5433:5432 `
  -d postgres:16
```

Later sessions:

```bash
docker start mdn-postgres
docker stop mdn-postgres
```

### 3. Configure env

```bash
cd mdn-event-management
cp .env.example .env
```

`.env` should contain:

```env
DATABASE_URL="postgresql://app_user:app_password@localhost:5433/event_management"
```

Do **not** commit `.env`. `.env.example` is safe to commit.

### 4. Install and migrate

```bash
cd mdn-event-management
npm install
npx prisma migrate dev
npx prisma generate
```

`migrate dev` applies the committed migrations in `prisma/migrations/` to your local DB.
**Yes — every teammate needs to run this** (or `npx prisma migrate reset` if they need a clean DB).

### 5. Run the app

```bash
npm run dev
```

## Day-to-day commands

| Task | Command (from `mdn-event-management/`) |
|------|----------------------------------------|
| Apply migrations | `npx prisma migrate dev` |
| Reset DB (wipes data, re-applies migrations) | `npx prisma migrate reset` |
| Regenerate Prisma Client after schema pull | `npx prisma generate` |
| Browse data | `npx prisma studio` |
| Check migration status | `npx prisma migrate status` |

## When the schema changes

1. Update `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name <short_description>`
3. Commit **both** `schema.prisma` and the new folder under `prisma/migrations/`
4. Teammates pull, then run `npx prisma migrate dev`

## Verify DB is up

```bash
docker exec mdn-postgres psql -U app_user -d event_management -c "SELECT current_user, current_database();"
```

Expected: `app_user | event_management`
