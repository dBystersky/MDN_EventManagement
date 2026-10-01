import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/locations/route";
import {
  DELETE as DELETE_ONE,
  GET as GET_ONE,
  PATCH as PATCH_ONE,
} from "@/app/api/locations/[locationId]/route";
import { prismaError, prismaMock } from "../helpers/prisma";
import { jsonRequest, params, read } from "../helpers/request";

const ctx = params({ locationId: "2" });
const location = { locationId: 2, name: "Woodside Building" };

describe("/api/locations", () => {
  it("GET lists locations by name", async () => {
    prismaMock.location.findMany.mockResolvedValue([location] as never);

    const { status, json } = await read(await GET());

    expect(status).toBe(200);
    expect(json).toEqual([location]);
    expect(prismaMock.location.findMany).toHaveBeenCalledWith({ orderBy: { name: "asc" } });
  });

  it("GET returns 500 when the query fails", async () => {
    prismaMock.location.findMany.mockRejectedValue(new Error("db down"));

    expect((await GET()).status).toBe(500);
  });

  it("POST creates a location", async () => {
    prismaMock.location.create.mockResolvedValue(location as never);

    const { status, json } = await read(
      await POST(jsonRequest("POST", { name: "Woodside Building" })),
    );

    expect(status).toBe(201);
    expect(json).toEqual(location);
    expect(prismaMock.location.create).toHaveBeenCalledWith({
      data: { name: "Woodside Building" },
    });
  });

  it("POST returns 500 when the insert fails", async () => {
    prismaMock.location.create.mockRejectedValue(prismaError("P2002"));

    expect((await POST(jsonRequest("POST", { name: "dup" }))).status).toBe(500);
  });
});

describe("/api/locations/[locationId]", () => {
  it("GET returns one location", async () => {
    prismaMock.location.findUnique.mockResolvedValue(location as never);

    const { status, json } = await read(await GET_ONE(jsonRequest("GET"), ctx));

    expect(status).toBe(200);
    expect(json).toEqual(location);
    expect(prismaMock.location.findUnique).toHaveBeenCalledWith({ where: { locationId: 2 } });
  });

  it("GET returns 404 when the lookup throws", async () => {
    prismaMock.location.findUnique.mockRejectedValue(new Error("boom"));

    expect((await GET_ONE(jsonRequest("GET"), ctx)).status).toBe(404);
  });

  it("PATCH renames a location", async () => {
    prismaMock.location.update.mockResolvedValue({ ...location, name: "LTB" } as never);

    const { status, json } = await read(
      await PATCH_ONE(jsonRequest("PATCH", { name: "LTB" }), ctx),
    );

    expect(status).toBe(200);
    expect(json.name).toBe("LTB");
    expect(prismaMock.location.update).toHaveBeenCalledWith({
      where: { locationId: 2 },
      data: { name: "LTB" },
    });
  });

  it("DELETE removes the location's events and then the location", async () => {
    prismaMock.location.findUniqueOrThrow.mockResolvedValue(location as never);

    const { status, json } = await read(await DELETE_ONE(jsonRequest("DELETE"), ctx));

    expect(status).toBe(200);
    expect(json.message).toBe("Location deleted successfully");
    expect(prismaMock.event.deleteMany).toHaveBeenCalledWith({
      where: { location: { locationId: 2 } },
    });
    expect(prismaMock.location.delete).toHaveBeenCalledWith({ where: { locationId: 2 } });
  });

  it("DELETE returns 500 when the location is missing", async () => {
    prismaMock.location.findUniqueOrThrow.mockRejectedValue(prismaError("P2025"));

    expect((await DELETE_ONE(jsonRequest("DELETE"), ctx)).status).toBe(500);
    expect(prismaMock.location.delete).not.toHaveBeenCalled();
  });

  // Current behaviour: unknown ids give 200 `null` (GET) or 500 (PATCH/DELETE).
  it.todo("returns 404 for a location id that does not exist");
});
