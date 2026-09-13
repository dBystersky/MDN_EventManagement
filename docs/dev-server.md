# Running the test server

There are **two servers**: the Postgres container and the Next.js dev server. Start the
database first — the app connects to it on boot.

Not set up yet? Start with [setup.md](./setup.md).

## Start

```bash
# 1. database
docker start mdn-postgres        # or: podman start mdn-postgres

# 2. app — from mdn-event-management/
npm run dev                      # http://localhost:3000
```

`start` on an already-running container is harmless. It *fails* if the container was removed —
recreate it with the `run` command in [setup.md](./setup.md); if you have the `mdn-pgdata`
volume your data is still there.

## Stop

```bash
# Ctrl+C in the terminal running npm run dev, then:
docker stop mdn-postgres         # or: podman stop mdn-postgres
```

Leaving the container running between sessions is fine — it costs almost nothing idle.

## Running the tests

**The test suite is an integration suite.** It does not mock anything: it makes real HTTP
requests against `http://localhost:3000/api/tasks` and `/api/events` and writes to your real
local database. So both servers must already be up, with `npm run dev` left running in another
terminal.

```bash
# terminal 1
npm run dev

# terminal 2, from mdn-event-management/
npm test                 # tests/task-api.test.ts + tests/task-budget.test.ts
npm run test:api         # same thing
```

If the app isn't running you get an explicit failure:
`API not reachable at http://localhost:3000/api/tasks. Start the app with: npm run dev`.

To point the tests at a different host:

```bash
TASK_API_BASE=http://localhost:3001/api/tasks \
EVENT_API_BASE=http://localhost:3001/api/events \
npm test
```

Because the tests create and delete real records, run them against **your own** local
database — never anything shared. They clean up after themselves, but a failed run can leave
rows behind; `npx prisma migrate reset` gives you a clean slate.

## Browsing the data

```bash
npx prisma studio                # GUI at http://localhost:5555
```

Or straight to psql:

```bash
docker exec -it mdn-postgres psql -U app_user -d event_management
# podman: same with `podman`
```

## Troubleshooting

**Port 3000 still in use** after the dev server exited badly:

```bash
ss -tlnp | grep 3000     # Linux
kill <pid>
```

On Windows: `netstat -ano | findstr :3000`, then `taskkill /PID <pid> /F`.

**Port 5433 already in use** — something else is bound there:

```bash
ss -tlnp | grep 5433
```

Stop that process, or change the port in both the container's `-p` mapping and `DATABASE_URL`.

**Prisma / the app can't connect** — the container is stopped. Check `docker ps -a` /
`podman ps -a` and start it. If `.env` is missing, see [setup.md](./setup.md).

**Postgres logs:**

```bash
docker logs -f mdn-postgres       # or: podman logs -f mdn-postgres
```

**podman: `Error: short-name resolution enforced`** — use the fully-qualified image name
`docker.io/library/postgres:16`.

### Optional: start the DB automatically on login (podman, Linux)

Not needed — `podman start` is fine. But if you're tired of typing it:

```bash
podman generate systemd --name mdn-postgres --new --files
systemctl --user enable --now container-mdn-postgres
loginctl enable-linger "$USER"    # keeps it running after you log out
```

Docker Desktop has an equivalent: set the container's restart policy to "Always" in its
settings.
