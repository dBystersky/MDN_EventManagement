import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/admin/members/route";
import { DELETE } from "@/app/api/admin/members/[id]/route";
import { comparePassword } from "@/lib/auth";
import { asUser } from "../helpers/auth";
import { prismaMock } from "../helpers/prisma";
import { jsonRequest, params, read } from "../helpers/request";

const body = { name: "Grace", email: "grace@mdn.test", password: "hunter22", role: "Manager" };

describe("POST /api/admin/members", () => {
  it("returns 401 without a session", async () => {
    const { status } = await read(await POST(jsonRequest("POST", body)));

    expect(status).toBe(401);
    expect(prismaMock.member.create).not.toHaveBeenCalled();
  });

  it.each(["Member", "Manager"] as const)("returns 403 for a %s", async (role) => {
    asUser(role);

    const { status } = await read(await POST(jsonRequest("POST", body)));

    expect(status).toBe(403);
    expect(prismaMock.member.create).not.toHaveBeenCalled();
  });

  it("returns 400 when fields are missing", async () => {
    asUser("Admin");

    const { status } = await read(await POST(jsonRequest("POST", { ...body, email: "" })));

    expect(status).toBe(400);
  });

  it("returns 400 when the email is taken", async () => {
    asUser("Admin");
    prismaMock.member.findUnique.mockResolvedValue({ memberId: 2 } as never);

    const { status } = await read(await POST(jsonRequest("POST", body)));

    expect(status).toBe(400);
    expect(prismaMock.member.create).not.toHaveBeenCalled();
  });

  it("creates the member with a hashed password and returns only public fields", async () => {
    asUser("Admin");
    prismaMock.member.findUnique.mockResolvedValue(null);
    const created = { memberId: 9, name: "Grace", email: "grace@mdn.test", role: "Manager" };
    prismaMock.member.create.mockResolvedValue(created as never);

    const { status, json } = await read(await POST(jsonRequest("POST", body)));

    expect(status).toBe(201);
    expect(json).toEqual(created);
    const call = prismaMock.member.create.mock.calls[0][0];
    expect(call.select).toEqual({ memberId: true, name: true, email: true, role: true });
    expect(call.data).toMatchObject({ name: "Grace", email: "grace@mdn.test", role: "Manager" });
    expect(await comparePassword("hunter22", call.data.password)).toBe(true);
  });
});

describe("DELETE /api/admin/members/[id]", () => {
  it("returns 401 without a session", async () => {
    const { status } = await read(await DELETE(jsonRequest("DELETE"), params({ id: "5" })));

    expect(status).toBe(401);
  });

  it("returns 403 for a non-admin", async () => {
    asUser("Manager");

    const { status } = await read(await DELETE(jsonRequest("DELETE"), params({ id: "5" })));

    expect(status).toBe(403);
    expect(prismaMock.member.delete).not.toHaveBeenCalled();
  });

  it("returns 400 for a non-numeric id", async () => {
    asUser("Admin");

    const { status } = await read(await DELETE(jsonRequest("DELETE"), params({ id: "abc" })));

    expect(status).toBe(400);
  });

  it("refuses to let an admin delete their own account", async () => {
    asUser("Admin", { member_id: 5 });

    const { status, json } = await read(await DELETE(jsonRequest("DELETE"), params({ id: "5" })));

    expect(status).toBe(400);
    expect(json.error).toBe("You cannot delete your own account");
    expect(prismaMock.member.delete).not.toHaveBeenCalled();
  });

  it("deletes another member", async () => {
    asUser("Admin", { member_id: 1 });

    const { status } = await read(await DELETE(jsonRequest("DELETE"), params({ id: "5" })));

    expect(status).toBe(200);
    expect(prismaMock.member.delete).toHaveBeenCalledWith({ where: { memberId: 5 } });
  });

  it("returns 500 when the delete fails", async () => {
    asUser("Admin", { member_id: 1 });
    prismaMock.member.delete.mockRejectedValue(new Error("fk violation"));

    const { status } = await read(await DELETE(jsonRequest("DELETE"), params({ id: "5" })));

    expect(status).toBe(500);
  });
});
