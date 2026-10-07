# Testing

[Vitest](https://vitest.dev). Tests live in `mdn-event-management/tests/` and
need **no database and no running app**, so they run the same on your machine
and in CI.

```bash
npm test             # vitest run
npm run test:watch   # re-runs on save
```

Run `npx prisma generate` first if you have not, since the tests import the
generated client's types.

## The two kinds

**Pure**: functions with no Prisma and no React, tested directly.
`tests/conflicts.test.ts` (clash maths) and `tests/validation.test.ts` (input
rules) are the examples. When logic is easy to get subtly wrong, put it in a
pure `lib/` module so it can be tested this way.

**Route**: `tests/api/*.test.ts` call the handlers in `app/api/**/route.ts`
directly, with the Prisma client swapped for a mock (`tests/setup.ts`). Stub
the queries a test needs, then assert on the response and on what was written:

```ts
import { POST } from "@/app/api/locations/route";
import { prismaMock } from "../helpers/prisma";
import { jsonRequest, read } from "../helpers/request";

it("creates a location", async () => {
  prismaMock.location.create.mockResolvedValue({ locationId: 1, name: "Hall" } as never);

  const { status } = await read(await POST(jsonRequest("POST", { name: "Hall" })));

  expect(status).toBe(201);
});
```

Helpers in `tests/helpers/`:

| Helper | Use |
|--------|-----|
| `prismaMock`, `prismaError("P2025")` | Stub queries; throw a Prisma error |
| `jsonRequest`, `params`, `read` | Build a request, a dynamic route's params, and read the response |
| `asUser("Admin")`, `asAnonymous()` | Sign the request in, with a real JWT |

Two things that catch people:

- **An unstubbed query returns `undefined`**, not an empty list. If a handler
  goes on to call `.map` on it, you get a 500 that has nothing to do with what
  you are testing. Stub it with `[]`.
- **Each test starts from a fresh mock** (`resetPrismaMock` in `beforeEach`), so
  stubs do not leak between tests.

## Before you push

These are the checks CI runs on every pull request:

```bash
npm run typecheck      # next typegen && tsc --noEmit
npm run lint
npm run format:check   # fix with npm run format
npm test
```

`npm run build` is not in CI, but run it before a PR that touches pages.
