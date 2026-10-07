import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/resource-types/route";
import {
  DELETE as DELETE_ONE,
  GET as GET_ONE,
  PATCH as PATCH_ONE,
} from "@/app/api/resource-types/[typeId]/route";
import { prismaError, prismaMock } from "../helpers/prisma";
import { jsonRequest, params, read } from "../helpers/request";

const ctx = params({ typeId: "1" });
const resourceType = { typeId: 1, name: "AV" };

describe("/api/resource-types", () => {
  it("GET lists resource types by name", async () => {
    prismaMock.resourceType.findMany.mockResolvedValue([resourceType] as never);

    const { status, json } = await read(await GET());

    expect(status).toBe(200);
    expect(json).toEqual([resourceType]);
    expect(prismaMock.resourceType.findMany).toHaveBeenCalledWith({ orderBy: { name: "asc" } });
  });

  it("GET returns 500 when the query fails", async () => {
    prismaMock.resourceType.findMany.mockRejectedValue(new Error("db down"));

    expect((await GET()).status).toBe(500);
  });

  it("POST creates a resource type", async () => {
    prismaMock.resourceType.create.mockResolvedValue(resourceType as never);

    const { status, json } = await read(await POST(jsonRequest("POST", { name: "AV" })));

    expect(status).toBe(201);
    expect(json).toEqual(resourceType);
    expect(prismaMock.resourceType.create).toHaveBeenCalledWith({ data: { name: "AV" } });
  });

  it("POST returns 500 with the Prisma error code on a duplicate name", async () => {
    prismaMock.resourceType.create.mockRejectedValue(prismaError("P2002"));

    const { status, json } = await read(await POST(jsonRequest("POST", { name: "AV" })));

    expect(status).toBe(500);
    expect(json).toMatchObject({ error: "Failed to create resource type", code: "P2002" });
  });
});

describe("/api/resource-types/[typeId]", () => {
  it("GET returns one resource type", async () => {
    prismaMock.resourceType.findUnique.mockResolvedValue(resourceType as never);

    const { status, json } = await read(await GET_ONE(jsonRequest("GET"), ctx));

    expect(status).toBe(200);
    expect(json).toEqual(resourceType);
    expect(prismaMock.resourceType.findUnique).toHaveBeenCalledWith({ where: { typeId: 1 } });
  });

  it("GET returns 404 when the lookup throws", async () => {
    prismaMock.resourceType.findUnique.mockRejectedValue(new Error("boom"));

    expect((await GET_ONE(jsonRequest("GET"), ctx)).status).toBe(404);
  });

  it("PATCH renames a resource type", async () => {
    prismaMock.resourceType.update.mockResolvedValue({ typeId: 1, name: "Audio" } as never);

    const { status } = await read(await PATCH_ONE(jsonRequest("PATCH", { name: "Audio" }), ctx));

    expect(status).toBe(200);
    expect(prismaMock.resourceType.update).toHaveBeenCalledWith({
      where: { typeId: 1 },
      data: { name: "Audio" },
    });
  });

  it("PATCH returns 404 for an unknown type", async () => {
    prismaMock.resourceType.update.mockRejectedValue(prismaError("P2025"));

    expect((await PATCH_ONE(jsonRequest("PATCH", { name: "x" }), ctx)).status).toBe(404);
  });

  it("DELETE cascades to the type's resources and their allocations", async () => {
    prismaMock.resourceType.findUniqueOrThrow.mockResolvedValue(resourceType as never);
    prismaMock.resource.findMany.mockResolvedValue([{ resourceId: 5 }, { resourceId: 6 }] as never);

    const { status } = await read(await DELETE_ONE(jsonRequest("DELETE"), ctx));

    expect(status).toBe(200);
    expect(prismaMock.resourceAllocation.deleteMany).toHaveBeenCalledWith({
      where: { resourceId: { in: [5, 6] } },
    });
    expect(prismaMock.resource.deleteMany).toHaveBeenCalledWith({ where: { resourceType: 1 } });
    expect(prismaMock.resourceType.delete).toHaveBeenCalledWith({ where: { typeId: 1 } });
  });

  it("DELETE returns 404 for an unknown type", async () => {
    prismaMock.resourceType.findUniqueOrThrow.mockRejectedValue(prismaError("P2025"));

    expect((await DELETE_ONE(jsonRequest("DELETE"), ctx)).status).toBe(404);
    expect(prismaMock.resourceType.delete).not.toHaveBeenCalled();
  });
});
