# Setup (Docker / podman)

First-time local setup. Everyone runs **their own local Postgres** — there is no shared team
database. After cloning you need to: start a Postgres container, create `.env`, install
dependencies, and apply migrations.

Once you're set up, see [dev-server.md](./dev-server.md) for day-to-day start/stop and
[database.md](./database.md) for the schema workflow.

## Pick your container runtime

| You're on | Use | Notes |
|-----------|-----|-------|
| Windows / macOS | **Docker Desktop** | Must be running before any `docker` command |
| Linux | **podman** | Rootless and daemonless — nothing to launch, no `sudo` |

Everything below is given for both. Run the block for your runtime and skip the other.

## 1. Prerequisites

```bash
node --version        # 20+
docker --version      # or: podman --version
```

On Windows/macOS, launch Docker Desktop now. On Fedora, podman is preinstalled; elsewhere
install it from your package manager.

## 2. Create the Postgres container (first time only)

**Docker:**

```bash
docker run --name mdn-postgres \
  -e POSTGRES_USER=app_user \
  -e POSTGRES_PASSWORD=app_password \
  -e POSTGRES_DB=event_management \
  -p 5433:5432 \
  -v mdn-pgdata:/var/lib/postgresql/data \
  -d postgres:16
```

**podman:**

```bash
podman run --name mdn-postgres \
  -e POSTGRES_USER=app_user \
  -e POSTGRES_PASSWORD=app_password \
  -e POSTGRES_DB=event_management \
  -p 5433:5432 \
  -v mdn-pgdata:/var/lib/postgresql/data \
  -d docker.io/library/postgres:16
```

Three things worth knowing:

- **Port 5433**, not the default 5432 — so it can't collide with a Postgres you already have
  installed. The port appears again in `DATABASE_URL`; change both or neither.
- **`-v mdn-pgdata:...`** stores the data in a named volume, so removing the container does
  not destroy your database. If you set this project up before this doc existed, you probably
  have no volume — recreating the container with `-v` starts from an empty database, which is
  fine, just re-run the migrations in step 4.
- **podman needs the fully-qualified image name** `docker.io/library/postgres:16`; it refuses
  bare short names rather than guessing a registry.

> On Windows, PowerShell continues lines with a backtick `` ` `` rather than `\`. Either
> swap them or paste the command as a single line.

## 3. Configure env

```bash
cd mdn-event-management
cp .env.example .env
```

`.env` should contain:

```env
DATABASE_URL="postgresql://app_user:app_password@localhost:5433/event_management"
JWT_SECRET="change-me-in-production"
```

Do **not** commit `.env` — it's gitignored. `.env.example` is safe to commit.

`prisma/schema.prisma` deliberately has no URL in its `datasource` block; `prisma.config.ts`
reads `DATABASE_URL` from the environment instead. So a missing `.env` makes every Prisma
command fail immediately.

## 4. Install and migrate

```bash
cd mdn-event-management
npm install
npx prisma migrate dev
npx prisma generate
```

`migrate dev` applies the committed migrations in `prisma/migrations/` to your local DB.
**Every teammate needs to run this** — see [database.md](./database.md) for what to do when
someone changes the schema.

## 5. Verify

```bash
docker ps        # or: podman ps
```

`mdn-postgres` should be `Up`, with `0.0.0.0:5433->5432/tcp`.

```bash
docker exec mdn-postgres psql -U app_user -d event_management \
  -c "SELECT current_user, current_database();"
# podman: same command with `podman` instead of `docker`
```

Expected:

```
 current_user | current_database
--------------+------------------
 app_user     | event_management
```

Finally, from `mdn-event-management/`:

```bash
npx prisma migrate status     # → "Database schema is up to date!"
```

Then start the app — see [dev-server.md](./dev-server.md).

## Teardown / clean slate

Only when you want to throw the container away entirely:

```bash
docker stop mdn-postgres
docker rm mdn-postgres
docker volume rm mdn-pgdata      # ⚠️ DESTROYS all local data
# podman: same three commands with `podman`
```

Then redo steps 2 and 4.

If you only want empty tables — not a fresh container — use `npx prisma migrate reset`
instead. It's much faster and leaves the container alone. See [database.md](./database.md).
