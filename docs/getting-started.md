# Getting started

Clone to running app. Everything runs from `mdn-event-management/`.

You need **Node 20 or newer** (developed on 26.x) and **Docker or Podman** for
Postgres. There is no shared team database — everyone runs their own. No Node
on your machine? See [Running Node in a container](#running-node-in-a-container).

## 1. Start Postgres on port 5433

```bash
docker run --name mdn-postgres -d -p 5433:5432 \
  -e POSTGRES_USER=app_user \
  -e POSTGRES_PASSWORD=app_password \
  -e POSTGRES_DB=event_management \
  docker.io/library/postgres:17
```

Swap `docker` for `podman` if that is what you have; the flags are identical.
Keep the full `docker.io/library/` image name: Podman resolves a bare
`postgres:17` against its own registry list, which on Fedora tries
`registry.fedoraproject.org` first and fails with `manifest unknown`.
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

The seed prints the admin credentials it used — by default `executive@mdn.com` /
`changeme123`. Override them with `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`
in `.env` before seeding.

Two one-command alternatives apply pending migrations and then **wipe every
table** (they ask first; add `-- --yes` to skip the prompt):

```bash
npm run db:init            # empty database, just the admin account
npm run db:demo            # the admin plus demo data that looks in use
```

The demo data is dated relative to when you run it, so there is always recent
history and upcoming events. Besides the admin it creates three Managers and eight
Members, all with the password `demo1234`. Log in as `manager@mdn.com` or
`member@mdn.com` to try each role. It also plants two clashes (a venue and a
projector) so the conflict flags have something to show.

## 4. Run it

```bash
npm run dev
```

Open <http://localhost:3000>. It redirects to `/login`; sign in with the seeded
admin. **There is no self-signup** — `/signup` redirects to `/login`, and new
accounts are created by an admin from the Members page.

## Running Node in a container

If you have Podman (or Docker) but no Node, run each `npm` command in the
official Node image instead. Host networking lets it reach Postgres on
`localhost:5433` and serve on `localhost:3000`, and `--userns=keep-id` keeps the
files it writes owned by you (Docker users drop that flag and `:Z`):

```bash
alias cnpm='podman run --rm -it --network host --userns=keep-id \
  -v "$PWD":/app:Z -w /app -e HOME=/tmp docker.io/library/node:24 npm'

cnpm install
cnpm run db:demo -- --yes
cnpm run dev
```

Use `node:24` (the current LTS). On `node:26`, `npm start` serves pages but
every API call fails (see the table below), and `node:22` ships an older npm
that rewrites `package-lock.json` by stripping its `libc` fields. If
`git status` shows the lockfile changed after an install you did not mean to
change anything with, `git checkout package-lock.json`.

## Something went wrong

| Symptom | Fix |
|---------|-----|
| `Can't reach database server at localhost:5433` | Container is not running: `docker start mdn-postgres` |
| `DATABASE_URL is not set` | You skipped `cp .env.example .env` |
| `Unknown field X for select statement on model Y`, or type errors about a field you can plainly see in `schema.prisma` | Your generated client is stale: `npx prisma generate`, then restart the dev server |
| Every page bounces to `/login` | Expected when not signed in; the seed creates the first account |
| `npx prisma migrate status` reports pending migrations | `npx prisma migrate dev` |
| `npm run build` fails type checking with `Cannot find module '../../../app/api/…/route.js'` in `.next/dev/types/validator.ts` | Leftover types from an old `npm run dev` that point at a route which has since moved: `rm -rf .next`, then build again |
| On Node 26, `npm start` serves pages but API calls such as login return 500, and the server logs `Failed to load external module next/dist/server/app-render/…` | Next 16.3 production builds do not run on Node 26 yet; use Node 24 |
| Podman: `reading manifest 17 in registry.fedoraproject.org/postgres: manifest unknown` | Use the full image name `docker.io/library/postgres:17`, as in step 1 |

More on the database in [database.md](./database.md).
