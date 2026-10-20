#!/usr/bin/env bash
# Start everything for a demo: Postgres, dependencies, fresh demo data, and a
# production build on http://localhost:3000. Follows docs/demo-checklist.md.
#
#   scripts/demo.sh              wipe and reload demo data, build, start
#   scripts/demo.sh --keep-data  skip the reload (restarting mid-demo)
#   scripts/demo.sh --dev        run `npm run dev` instead of build + start
#
# Uses npm from the host if there is one, otherwise runs it in the node:24
# image (see "Running Node in a container" in docs/getting-started.md).
# Set CONTAINER_ENGINE=docker or podman to pick one when both are installed.
# Re-run under bash if started as `sh scripts/demo.sh` (dash has no arrays).
if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
set -euo pipefail

cd "$(dirname "$0")/.."

PG_CONTAINER=mdn-postgres
PG_IMAGE=docker.io/library/postgres:17
NODE_IMAGE=docker.io/library/node:24
APP_CONTAINER=mdn-app
APP_PORT=3000

keep_data=false
dev=false
for arg in "$@"; do
  case "$arg" in
    --keep-data) keep_data=true ;;
    --dev) dev=true ;;
    -h | --help)
      sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown option: $arg (try --help)" >&2
      exit 1
      ;;
  esac
done

step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

engine=${CONTAINER_ENGINE:-}
if [[ -z "$engine" ]]; then
  if command -v podman >/dev/null; then
    engine=podman
  elif command -v docker >/dev/null; then
    engine=docker
  else
    echo "Need Docker or Podman to run Postgres." >&2
    exit 1
  fi
fi

if command -v npm >/dev/null; then
  run_npm() { npm "$@"; }
else
  echo "No npm on this machine; running it in $NODE_IMAGE."
  if [[ "$engine" == podman ]]; then
    user_flags=(--userns=keep-id)
  else
    user_flags=(--user "$(id -u):$(id -g)")
  fi
  tty_flags=()
  [[ -t 0 && -t 1 ]] && tty_flags=(-it)
  # Set app_name to name the container (for the long-running server).
  app_name=()
  run_npm() {
    "$engine" run --rm --init "${app_name[@]}" "${tty_flags[@]}" --network host "${user_flags[@]}" \
      -v "$PWD":/app:Z -w /app -e HOME=/tmp -e NEXT_TELEMETRY_DISABLED=1 \
      "$NODE_IMAGE" npm "$@"
  }
fi

# Check before the slow steps rather than failing after the build.
if (exec 3<>"/dev/tcp/127.0.0.1/$APP_PORT") 2>/dev/null; then
  echo "Port $APP_PORT is already in use, probably by an earlier run." >&2
  echo "Stop it with Ctrl-C in its terminal, or: $engine rm -f $APP_CONTAINER" >&2
  exit 1
fi

step "Postgres ($PG_CONTAINER on port 5433)"
if "$engine" container inspect "$PG_CONTAINER" >/dev/null 2>&1; then
  "$engine" start "$PG_CONTAINER" >/dev/null
else
  "$engine" run --name "$PG_CONTAINER" -d -p 5433:5432 \
    -e POSTGRES_USER=app_user \
    -e POSTGRES_PASSWORD=app_password \
    -e POSTGRES_DB=event_management \
    "$PG_IMAGE" >/dev/null
fi
# Check over TCP: on first start the image runs initdb against a socket-only
# server, so a socket check can pass before the real server is up.
for _ in $(seq 1 30); do
  if "$engine" exec "$PG_CONTAINER" pg_isready -q -h 127.0.0.1 -U app_user -d event_management; then
    break
  fi
  sleep 1
done
"$engine" exec "$PG_CONTAINER" pg_isready -q -h 127.0.0.1 -U app_user -d event_management ||
  { echo "Postgres did not come up; see: $engine logs $PG_CONTAINER" >&2; exit 1; }
echo "Ready."

if [[ ! -f .env ]]; then
  step "Creating .env from .env.example"
  cp .env.example .env
fi

step "npm install"
run_npm install

if [[ "$keep_data" == false ]]; then
  step "Loading demo data (wipes every table)"
  run_npm run db:demo -- --yes
fi

if [[ "$dev" == true ]]; then
  step "Starting dev server on http://localhost:3000 (Ctrl-C to stop)"
  app_name=(--name "$APP_CONTAINER")
  run_npm run dev
else
  step "Building"
  # Old `npm run dev` output in .next/dev can point at moved routes and fail the
  # build's type check.
  rm -rf .next
  run_npm run build
  step "Starting on http://localhost:3000 (Ctrl-C to stop)"
  echo "Postgres keeps running afterwards; stop it with: $engine stop $PG_CONTAINER"
  app_name=(--name "$APP_CONTAINER")
  run_npm start
fi
