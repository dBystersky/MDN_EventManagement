# Testing

Node's built-in test runner via `tsx`. Tests live in `mdn-event-management/tests/`
and come in two kinds, which matters because one kind needs infrastructure and
the other does not.

## The two kinds

**Unit** — pure functions, no database, no server. Fast, and they run anywhere.
`tests/conflicts.test.ts` is the example.

```bash
npm run test:unit
```

**API** — hit a running app over HTTP and read the real database. They create
their own fixtures and clean up after themselves in `after()`.

```bash
npm run dev          # in another terminal, and Postgres must be up
npm run test:api
```

`npm test` runs everything. Expect **55 tests** passing.

## Writing an API test

Every `/api/` route is behind `middleware.ts`, so a bare `fetch` gets `401`. Use
`tests/auth-helper.ts`, which mints a throwaway admin and hands back a `fetch`
that carries the session cookie:

```ts
import { apiClient, assertApiReachable, createTestSession } from "./auth-helper.ts";

before(async () => {
  await assertApiReachable();
  session = await createTestSession("my-suite");
  api = apiClient(session, `${ORIGIN}/api/things`);
});

after(async () => {
  await session.cleanup();   // deletes the throwaway member
  await prisma.$disconnect();
});
```

Two traps, both of which have bitten this suite:

- **`tsx --test` runs test files concurrently.** Never assert on a global count
  ("there are now 4 events") — another file is writing at the same time. Assert
  on the rows you created.
- **Give fixtures their own names and dates.** Two suites sharing a date will
  legitimately trigger each other's clash warnings.

## Before you push

```bash
npx tsc --noEmit     # expect zero errors
npm run lint         # 10 pre-existing errors; do not add more
npm run build        # must pass
npm test             # 55/55
```

`npm run lint` is not clean — there are 10 known errors, mostly `setState` in an
effect across the CRUD pages. Treat the count as the bar, not zero.
