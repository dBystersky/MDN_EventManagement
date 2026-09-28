/**
 * Signing the API test suites in.
 *
 * `middleware.ts` guards every `/api/` route with a session cookie, so a suite
 * that just calls `fetch` sees nothing but 401s. This mints a throwaway Admin,
 * exchanges it for a cookie, and hands back a `fetch` that carries it.
 */

import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.ts";

export const ORIGIN = process.env.API_ORIGIN ?? "http://localhost:3000";

export type TestSession = {
  cookie: string;
  memberId: number;
  /** Removes the throwaway member; call from the suite's `after`. */
  cleanup: () => Promise<void>;
};

/** Throws with a usable message when the app is not running. */
export async function assertApiReachable() {
  const reachable = await fetch(`${ORIGIN}/api/auth/login`, { method: "POST" }).catch(
    () => null,
  );
  if (!reachable) {
    throw new Error(`API not reachable at ${ORIGIN}. Start the app with: npm run dev`);
  }
}

/**
 * A throwaway Admin plus its session cookie.
 *
 * `label` only keeps concurrent suites from colliding on the unique email.
 */
export async function createTestSession(label: string): Promise<TestSession> {
  const stamp = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const password = `pw-${stamp}`;
  const email = `${stamp}@mdn.test`;

  const member = await prisma.member.create({
    data: {
      name: `Test ${label}`,
      role: "Admin",
      email,
      password: await bcrypt.hash(password, 10),
    },
  });

  const response = await fetch(`${ORIGIN}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(`Could not sign in as ${email} (${response.status})`);
  }

  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) throw new Error("Login returned no session cookie");

  return {
    // Just the name=value pair; the attributes are for a browser, not for us.
    cookie: setCookie.split(";")[0],
    memberId: member.memberId,
    cleanup: async () => {
      await prisma.member.deleteMany({ where: { memberId: member.memberId } });
    },
  };
}

/** A `fetch` for one base URL that sends the session cookie and parses JSON. */
export function apiClient(session: { cookie: string }, base: string) {
  return async function api(method: string, path = "", body?: unknown) {
    const headers: Record<string, string> = { Cookie: session.cookie };
    if (body) headers["Content-Type"] = "application/json";

    const response = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await response.json().catch(() => null);
    return { status: response.status, json };
  };
}
