# Docs

Written for the five of us working on this repo. Each page is meant to be read in
a couple of minutes.

| Page | Read it when |
|------|--------------|
| [getting-started.md](./getting-started.md) | You just cloned the repo and want the app running |
| [architecture.md](./architecture.md) | You need to know where code goes, or how the data model fits together |
| [database.md](./database.md) | You are changing the schema, or your local DB is out of sync |
| [testing.md](./testing.md) | You are writing or running tests |
| [conflict-detection.md](./conflict-detection.md) | You are touching clash flagging (Req 7) |
| [validation.md](./validation.md) | You are adding a form field, a form, or a write route (Req 9) |
| [RTM.md](./RTM.md) | You need the requirement list and its IDs |

Not docs: `CLAUDE.md` and `AGENTS.md` in `mdn-event-management/` are instructions
for AI coding agents, not for people.

## Adding a page

Keep it short. If a page needs a table of contents it is doing too much — split
it. Prefer linking to the code over restating it, since prose goes stale and
`lib/conflicts.ts` does not.
