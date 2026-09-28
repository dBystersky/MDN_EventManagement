# Getting started

Clone to running app. Everything runs from `mdn-event-management/`.

You need **Node 20 or newer** (developed on 26.x) and **Docker or Podman** for
Postgres. There is no shared team database — everyone runs their own.

## 1. Start Postgres on port 5433

```bash
docker run --name mdn-postgres -d -p 5433:5432 \
  -e POSTGRES_USER=app_user \
  -e POSTGRES_PASSWORD=app_password \
  -e POSTGRES_DB=event_management \
  postgres:17
```

Swap `docker` for `podman` if that is what you have; the flags are identical.
Later sessions just need `docker start mdn-postgres`.

## 2. Configure and install

```bash
cd mdn-event-management
cp .env.example .env
npm install
```

The defaults in `.env.example` match the container above, so it works unedited.
Never commit `.env`.

## 3. Set up the database

```bash
npx prisma migrate dev     # applies everything in prisma/migrations/
npx prisma generate        # regenerates the client into generated/prisma
npx prisma db seed         # creates the first admin account
```

`generated/prisma` is gitignored, so `generate` is not optional after a fresh
clone. `migrate dev` usually runs it for you.

The seed prints the admin credentials it used — by default `admin@mdn.com` /
`changeme123`. Override them with `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`
in `.env` before seeding.

## 4. Run it

```bash
npm run dev
```

Open <http://localhost:3000>. It redirects to `/login`; sign in with the seeded
admin. **There is no self-signup** — `/signup` redirects to `/login`, and new
accounts are created by an admin from the Members page.

## Something went wrong

| Symptom | Fix |
|---------|-----|
| `Can't reach database server at localhost:5433` | Container is not running: `docker start mdn-postgres` |
| `DATABASE_URL is not set` | You skipped `cp .env.example .env` |
| Type errors about a Prisma model you can see in the schema | `npx prisma generate` |
| Every page bounces to `/login` | Expected when not signed in; the seed creates the first account |
| `npx prisma migrate status` reports pending migrations | `npx prisma migrate dev` |

More on the database in [database.md](./database.md).
