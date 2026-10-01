import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/members/route";
import { prismaMock } from "../helpers/prisma";
import { read } from "../helpers/request";

describe("GET /api/members", () => {
  it("lists members without exposing password hashes", async () => {
    const member = { memberId: 1, name: "Ada", email: "ada@mdn.test", role: "Member" };
    prismaMock.member.findMany.mockResolvedValue([member] as never);

    const { status, json } = await read(await GET());

    expect(status).toBe(200);
    expect(json).toEqual([member]);
    expect(prismaMock.member.findMany).toHaveBeenCalledWith({
      orderBy: { name: "asc" },
      select: { memberId: true, name: true, email: true, role: true },
    });
  });

  it("returns 500 when the query fails", async () => {
    prismaMock.member.findMany.mockRejectedValue(new Error("db down"));

    expect((await GET()).status).toBe(500);
  });
});
