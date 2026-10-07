import { beforeEach, vi } from "vitest";
import { resetPrismaMock } from "./helpers/prisma";
import { cookieJar } from "./helpers/cookie-jar";

vi.mock("@/lib/prisma", async () => ({
  prisma: (await import("./helpers/prisma")).prismaMock,
}));

vi.mock("next/headers", async () => {
  const { cookieJar } = await import("./helpers/cookie-jar");
  return {
    cookies: async () => ({
      get: (name: string) =>
        name === "mdn_auth_token" && cookieJar.token ? { name, value: cookieJar.token } : undefined,
    }),
  };
});

beforeEach(() => {
  resetPrismaMock();
  cookieJar.token = undefined;
  // Routes log caught errors; keep test output readable.
  vi.spyOn(console, "error").mockImplementation(() => {});
});
