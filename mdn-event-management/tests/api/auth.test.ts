import { beforeAll, describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as signup } from "@/app/api/auth/signup/route";
import { AUTH_COOKIE_NAME, comparePassword, hashPassword, verifyToken } from "@/lib/auth";
import { asUser } from "../helpers/auth";
import { prismaMock } from "../helpers/prisma";
import { jsonRequest, read } from "../helpers/request";

const member = {
  memberId: 4,
  name: "Ada",
  email: "ada@mdn.test",
  role: "Member",
  password: "",
};

beforeAll(async () => {
  member.password = await hashPassword("correct-horse");
});

function authCookie(response: Response) {
  return (
    response as unknown as { cookies: { get(name: string): { value: string } | undefined } }
  ).cookies.get(AUTH_COOKIE_NAME);
}

describe("POST /api/auth/login", () => {
  it.each([
    ["email", { password: "x" }],
    ["password", { email: "ada@mdn.test" }],
  ])("returns 400 without %s", async (_field, body) => {
    const { status } = await read(await login(jsonRequest("POST", body)));

    expect(status).toBe(400);
    expect(prismaMock.member.findUnique).not.toHaveBeenCalled();
  });

  it("returns 401 for an unknown email", async () => {
    prismaMock.member.findUnique.mockResolvedValue(null);

    const { status, json } = await read(
      await login(jsonRequest("POST", { email: "nobody@mdn.test", password: "x" })),
    );

    expect(status).toBe(401);
    expect(json.error).toBe("Invalid email or password");
  });

  it("returns 401 for a wrong password", async () => {
    prismaMock.member.findUnique.mockResolvedValue(member as never);

    const response = await login(jsonRequest("POST", { email: "ada@mdn.test", password: "wrong" }));

    expect(response.status).toBe(401);
    expect(authCookie(response)).toBeUndefined();
  });

  it("signs the member in and sets an httpOnly session cookie", async () => {
    prismaMock.member.findUnique.mockResolvedValue(member as never);

    const response = await login(
      jsonRequest("POST", { email: "ada@mdn.test", password: "correct-horse" }),
    );
    const { status, json } = await read(response);

    expect(status).toBe(200);
    expect(json.user).toEqual({ member_id: 4, email: "ada@mdn.test", name: "Ada", role: "Member" });
    expect(json.user).not.toHaveProperty("password");
    expect(prismaMock.member.findUnique).toHaveBeenCalledWith({ where: { email: "ada@mdn.test" } });

    const cookie = authCookie(response);
    expect(cookie).toMatchObject({ httpOnly: true, path: "/" });
    expect(verifyToken(cookie!.value)).toMatchObject({ member_id: 4, role: "Member" });
  });

  it("returns 500 when the lookup fails", async () => {
    prismaMock.member.findUnique.mockRejectedValue(new Error("db down"));

    const { status } = await read(
      await login(jsonRequest("POST", { email: "ada@mdn.test", password: "x" })),
    );

    expect(status).toBe(500);
  });
});

describe("POST /api/auth/signup", () => {
  const body = { name: "Grace", email: "grace@mdn.test", password: "hunter22" };

  it.each(["name", "email", "password"])("returns 400 without %s", async (field) => {
    const { status } = await read(await signup(jsonRequest("POST", { ...body, [field]: "" })));

    expect(status).toBe(400);
    expect(prismaMock.member.create).not.toHaveBeenCalled();
  });

  it("returns 400 when the email is already registered", async () => {
    prismaMock.member.findUnique.mockResolvedValue(member as never);

    const { status, json } = await read(await signup(jsonRequest("POST", body)));

    expect(status).toBe(400);
    expect(json.error).toBe("A member with this email already exists");
    expect(prismaMock.member.create).not.toHaveBeenCalled();
  });

  it("creates the member with a hashed password and signs them in", async () => {
    prismaMock.member.findUnique.mockResolvedValue(null);
    prismaMock.member.create.mockResolvedValue({
      ...member,
      memberId: 9,
      name: "Grace",
      email: body.email,
    } as never);

    const response = await signup(jsonRequest("POST", body));
    const { status, json } = await read(response);

    expect(status).toBe(200);
    expect(json.user).toMatchObject({ member_id: 9, email: "grace@mdn.test" });

    const { data } = prismaMock.member.create.mock.calls[0][0];
    expect(data).toMatchObject({ name: "Grace", email: "grace@mdn.test", role: "Member" });
    expect(data.password).not.toBe("hunter22");
    expect(await comparePassword("hunter22", data.password)).toBe(true);

    expect(authCookie(response)).toMatchObject({ httpOnly: true });
  });

  it.each([
    ["Manager", "Manager"],
    ["Admin", "Admin"],
    ["Superuser", "Member"],
    [undefined, "Member"],
  ])("maps requested role %s to %s", async (requested, stored) => {
    prismaMock.member.findUnique.mockResolvedValue(null);
    prismaMock.member.create.mockResolvedValue(member as never);

    await signup(jsonRequest("POST", { ...body, role: requested }));

    expect(prismaMock.member.create.mock.calls[0][0].data.role).toBe(stored);
  });
});

describe("POST /api/auth/logout", () => {
  it("expires the session cookie", async () => {
    const response = await logout();

    expect(response.status).toBe(200);
    const cookie = authCookie(response) as unknown as { value: string; expires: Date };
    expect(cookie.value).toBe("");
    expect(new Date(cookie.expires).getTime()).toBe(0);
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 without a session", async () => {
    const { status, json } = await read(await me());

    expect(status).toBe(401);
    expect(json).toEqual({ authenticated: false, user: null });
  });

  it("returns the signed-in member", async () => {
    asUser("Manager", { member_id: 7, name: "Linus" });

    const { status, json } = await read(await me());

    expect(status).toBe(200);
    expect(json.authenticated).toBe(true);
    expect(json.user).toMatchObject({ member_id: 7, name: "Linus", role: "Manager" });
  });
});
