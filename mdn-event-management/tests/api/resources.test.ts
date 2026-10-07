import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/resources/route";
import {
  DELETE as DELETE_ONE,
  GET as GET_ONE,
  PATCH as PATCH_ONE,
} from "@/app/api/resources/[resourceId]/route";
import { prismaError, prismaMock } from "../helpers/prisma";
import { jsonRequest, params, read } from "../helpers/request";

const ctx = params({ resourceId: "5" });
const resource = {
  resourceId: 5,
  name: "Projector",
  resourceType: 1,
  resourceTypeRel: { typeId: 1, name: "AV" },
};

describe("/api/resources", () => {
  it("GET lists resources with their type", async () => {
    prismaMock.resource.findMany.mockResolvedValue([resource] as never);

    const { status, json } = await read(await GET());

    expect(status).toBe(200);
    expect(json).toEqual([resource]);
    expect(prismaMock.resource.findMany).toHaveBeenCalledWith({
      orderBy: { name: "asc" },
      include: { resourceTypeRel: true },
    });
  });

  it("GET returns 500 when the query fails", async () => {
    prismaMock.resource.findMany.mockRejectedValue(new Error("db down"));

    expect((await GET()).status).toBe(500);
  });

  it("POST creates a resource, coercing resourceTypeId to a number", async () => {
    prismaMock.resource.create.mockResolvedValue(resource as never);

    const { status } = await read(
      await POST(jsonRequest("POST", { name: "Projector", resourceTypeId: "1" })),
    );

    expect(status).toBe(201);
    expect(prismaMock.resource.create).toHaveBeenCalledWith({
      data: { name: "Projector", resourceType: 1 },
      include: { resourceTypeRel: true },
    });
  });

  it("POST returns 500 with the Prisma error code when the type does not exist", async () => {
    prismaMock.resource.create.mockRejectedValue(prismaError("P2003"));

    const { status, json } = await read(
      await POST(jsonRequest("POST", { name: "Projector", resourceTypeId: 99 })),
    );

    expect(status).toBe(500);
    expect(json).toMatchObject({ error: "Failed to create resource", code: "P2003" });
  });
});

describe("/api/resources/[resourceId]", () => {
  it("GET returns one resource", async () => {
    prismaMock.resource.findUnique.mockResolvedValue(resource as never);

    const { status, json } = await read(await GET_ONE(jsonRequest("GET"), ctx));

    expect(status).toBe(200);
    expect(json.resourceId).toBe(5);
  });

  it("GET returns 404 when the lookup throws", async () => {
    prismaMock.resource.findUnique.mockRejectedValue(new Error("boom"));

    expect((await GET_ONE(jsonRequest("GET"), ctx)).status).toBe(404);
  });

  it("PATCH updates only the fields given", async () => {
    prismaMock.resource.update.mockResolvedValue(resource as never);

    await PATCH_ONE(jsonRequest("PATCH", { name: "Big projector" }), ctx);

    expect(prismaMock.resource.update).toHaveBeenCalledWith({
      where: { resourceId: 5 },
      data: { name: "Big projector" },
      include: { resourceTypeRel: true },
    });
  });

  it("PATCH changes the resource type", async () => {
    prismaMock.resource.update.mockResolvedValue(resource as never);

    await PATCH_ONE(jsonRequest("PATCH", { resourceTypeId: "2" }), ctx);

    expect(prismaMock.resource.update.mock.calls[0][0].data).toEqual({
      name: undefined,
      resourceType: 2,
    });
  });

  it("PATCH returns 404 for an unknown resource", async () => {
    prismaMock.resource.update.mockRejectedValue(prismaError("P2025"));

    expect((await PATCH_ONE(jsonRequest("PATCH", { name: "x" }), ctx)).status).toBe(404);
  });

  it("DELETE removes allocations first, then the resource", async () => {
    prismaMock.resource.findUniqueOrThrow.mockResolvedValue(resource as never);

    const { status } = await read(await DELETE_ONE(jsonRequest("DELETE"), ctx));

    expect(status).toBe(200);
    expect(prismaMock.resourceAllocation.deleteMany).toHaveBeenCalledWith({
      where: { resourceId: 5 },
    });
    expect(prismaMock.resource.delete).toHaveBeenCalledWith({ where: { resourceId: 5 } });
  });

  it("DELETE returns 404 for an unknown resource", async () => {
    prismaMock.resource.findUniqueOrThrow.mockRejectedValue(prismaError("P2025"));

    expect((await DELETE_ONE(jsonRequest("DELETE"), ctx)).status).toBe(404);
    expect(prismaMock.resource.delete).not.toHaveBeenCalled();
  });

  it("DELETE returns 500 for other failures", async () => {
    prismaMock.resource.findUniqueOrThrow.mockRejectedValue(new Error("db down"));

    expect((await DELETE_ONE(jsonRequest("DELETE"), ctx)).status).toBe(500);
  });
});
