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


## Setting up PostgreSQL

This project uses PostgreSQL. **Each person runs their own local Postgres instance** — there is no shared/hosted database.
Your database lives only on your machine; nobody else can see your data, and you won't see theirs. 
We all just use the same setup steps so the app behaves identically for everyone.

1. Install PostgreSQL
2. `cp .env.example .env`
3. Initialise your own local Postgres data directory:
   ```bash
   initdb --locale en_US.UTF-8 -D ./postgres/data --data-checksums
   ```
4. Start it on port `5433` (not the default `5432`, to avoid clashing with any system Postgres you may already have):
   ```bash
   pg_ctl -D ./postgres/data -o "-p 5433" -l ./postgres/logfile start
   ```
5. Create the database and app role (same names for everyone, so the connection string below works without edits):
   ```bash
   createdb -p 5433 event_management
   psql -p 5433 -d event_management -c "CREATE ROLE app_user WITH LOGIN SUPERUSER;"
   ```
6. Load the schema:
   ```bash
   psql -p 5433 -d event_management -f schema.sql
   ```
7. Load the env vars into your shell (needed every new terminal session):
   ```bash
   source .env
   ```
8. Verify:
   ```bash
   psql "$DATABASE_URL" -c "SELECT current_user, current_database();"
   ```
   Should print `app_user | event_management`.

### Why this setup

- Everyone gets an identical `DATABASE_URL` (`postgresql://app_user@localhost:5433/event_management`) because we all create the same role name and database name locally — it's not because we're connecting to one shared server.
- Your test data, inserts, and schema changes only affect your own machine. If you change `schema.sql`, re-run step 6 to apply it locally, and let the team know so they do the same.
- Starting/stopping your local server day-to-day:
  ```bash
  pg_ctl -D ./postgres/data -o "-p 5433" -l ./postgres/logfile start
  pg_ctl -D ./postgres/data stop
  ```
- Env vars aren't loaded automatically — run `set -a; source .env; set +a` in each new terminal session before using `$DATABASE_URL`, `psql`, etc.

