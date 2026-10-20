# Demo checklist

Tick these off before showing the app to anyone. Every command runs from
`mdn-event-management/` unless it says otherwise.

## First time on this machine

Skip this if the app already runs for you. The details are in
[getting-started.md](./getting-started.md), including how to
[run Node in a container](./getting-started.md#running-node-in-a-container) if
this machine has no Node.

- [ ] Start Postgres on port 5433 (swap `docker` for `podman` if that is what you have):

  ```bash
  docker run --name mdn-postgres -d -p 5433:5432 \
    -e POSTGRES_USER=app_user \
    -e POSTGRES_PASSWORD=app_password \
    -e POSTGRES_DB=event_management \
    docker.io/library/postgres:17
  ```

- [ ] Configure and install:

  ```bash
  cd mdn-event-management
  cp .env.example .env
  npm install
  ```

## Before every demo

- [ ] Postgres is running: `docker start mdn-postgres`
- [ ] Code is current on the branch you are demoing: `git pull`, then
      `npm install` (this also regenerates the Prisma client)
- [ ] Load the demo data **on the day**, since its dates are relative to when it
      runs. This wipes every table:

  ```bash
  npm run db:demo -- --yes
  ```

- [ ] Start the app. A production build loads pages faster and has no dev
      error overlay:

  ```bash
  npm run build && npm start
  ```

  `npm run dev` works too if you need to change code mid-demo. If the build
  fails type checking in `.next/dev/types`, that is leftover output from an
  older dev run: `rm -rf .next` and build again.

- [ ] Open <http://localhost:3000>

## Logins

| Role | Email | Password |
|------|-------|----------|
| Executive | `executive@mdn.com` | `changeme123` (or `SEED_ADMIN_*` from `.env`) |
| Manager | `manager@mdn.com` | `demo1234` |
| Member | `member@mdn.com` | `demo1234` |

`db:demo` prints these at the end too. Members only see the events and tasks
they are on; Managers and the Executive see everything.

## Quick sanity check

- [ ] Sign in as the Executive; you land on Overview
- [ ] Events and Calendar show upcoming events, not just past ones
- [ ] The two planted clashes are flagged:
  - venue: "Research Project Showcase" and "Sponsor Info Session" share a
    lecture theatre
  - resource: Projector A is booked by the "Intro to Reinforcement Learning
    Workshop" and the "Rehearse AGM presentations" task at the same time
- [ ] The Audit Log has entries

## Afterwards

- [ ] Optional: reset to just the Executive account with `npm run db:init -- --yes`
- [ ] `docker stop mdn-postgres`

If something breaks, see "Something went wrong" in
[getting-started.md](./getting-started.md#something-went-wrong).
