import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";

/**
 * Stand-in for `prisma` from `@/lib/prisma`. `tests/setup.ts` swaps the real
 * client for this one, so route handlers and `lib/*` run as normal and only the
 * database calls are stubbed.
 */
export const prismaMock: DeepMockProxy<PrismaClient> = mockDeep<PrismaClient>();

export function resetPrismaMock() {
  mockReset(prismaMock);
  // Interactive transactions run against the same mock, so assertions on
  // `prismaMock.task.create` etc. cover calls made through `tx` too.
  prismaMock.$transaction.mockImplementation(((arg: unknown) =>
    typeof arg === "function" ? arg(prismaMock) : Promise.all(arg as Promise<unknown>[])) as never);
}

/** A Prisma error as thrown by the client, e.g. `P2025` for "record not found". */
export function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError(`Mock Prisma error ${code}`, {
    code,
    clientVersion: "test",
  });
}
