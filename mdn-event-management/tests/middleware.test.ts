import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "@/middleware";

function request(path: string, token?: string) {
  return new NextRequest(`http://localhost${path}`, {
    headers: token ? { cookie: `mdn_auth_token=${token}` } : undefined,
  });
}

/** `NextResponse.next()` marks pass-through responses with this header. */
function passedThrough(response: Response) {
  return response.headers.get("x-middleware-next") === "1";
}

describe("middleware", () => {
  it.each(["/", "/login", "/signup", "/api/auth/login", "/api/auth/logout", "/_next/data/x.json"])(
    "lets %s through without a session",
    (path) => {
      expect(passedThrough(middleware(request(path)))).toBe(true);
    },
  );

  it("answers API calls without a session with 401 JSON", async () => {
    const response = middleware(request("/api/tasks"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Authentication required" });
  });

  it("redirects page requests without a session to /login", () => {
    const response = middleware(request("/events"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });

  it("lets requests with a session cookie through", () => {
    expect(passedThrough(middleware(request("/api/tasks", "any-token")))).toBe(true);
    expect(passedThrough(middleware(request("/events", "any-token")))).toBe(true);
  });
});
