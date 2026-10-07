import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/resource-allocations/route";
import {
  DELETE as DELETE_ONE,
  GET as GET_ONE,
  PATCH as PATCH_ONE,
} from "@/app/api/resource-allocations/[allocationId]/route";
import { prismaError, prismaMock } from "../helpers/prisma";
import { jsonRequest, params, read } from "../helpers/request";

const ctx = params({ allocationId: "12" });
const allocation = {
  allocationId: 12,
  resourceId: 5,
  bookableId: 30,
  startTime: new Date("2026-09-06T00:00:00.000Z"),
  endTime: new Date("2026-09-06T02:00:00.000Z"),
};
const include = {
  resource: { include: { resourceTypeRel: true } },
  bookable: true,
};

describe("/api/resource-allocations", () => {
  it("GET lists allocations by start time", async () => {
    prismaMock.resourceAllocation.findMany.mockResolvedValue([allocation] as never);

    const { status, json } = await read(await GET());

    expect(status).toBe(200);
    expect(json[0].allocationId).toBe(12);
    expect(prismaMock.resourceAllocation.findMany).toHaveBeenCalledWith({
      orderBy: { startTime: "asc" },
      include,
    });
  });

  it("GET returns 500 when the query fails", async () => {
    prismaMock.resourceAllocation.findMany.mockRejectedValue(new Error("db down"));

    expect((await GET()).status).toBe(500);
  });

  it("POST creates an allocation, coercing ids and dates", async () => {
    prismaMock.resourceAllocation.create.mockResolvedValue(allocation as never);

    const { status } = await read(
      await POST(
        jsonRequest("POST", {
          resourceId: "5",
          bookableId: "30",
          startTime: "2026-09-06T00:00:00.000Z",
          endTime: "2026-09-06T02:00:00.000Z",
        }),
      ),
    );

    expect(status).toBe(201);
    expect(prismaMock.resourceAllocation.create).toHaveBeenCalledWith({
      data: {
        resourceId: 5,
        bookableId: 30,
        startTime: allocation.startTime,
        endTime: allocation.endTime,
      },
      include,
    });
  });

  it("POST returns 500 with the Prisma error code on a bad reference", async () => {
    prismaMock.resourceAllocation.create.mockRejectedValue(prismaError("P2003"));

    const { status, json } = await read(
      await POST(
        jsonRequest("POST", {
          resourceId: 99,
          bookableId: 30,
          startTime: "2026-09-06T00:00:00.000Z",
          endTime: "2026-09-06T02:00:00.000Z",
        }),
      ),
    );

    expect(status).toBe(500);
    expect(json).toMatchObject({ error: "Failed to create resource allocation", code: "P2003" });
  });
});

describe("/api/resource-allocations/[allocationId]", () => {
  it("GET returns one allocation", async () => {
    prismaMock.resourceAllocation.findUnique.mockResolvedValue(allocation as never);

    const { status, json } = await read(await GET_ONE(jsonRequest("GET"), ctx));

    expect(status).toBe(200);
    expect(json.allocationId).toBe(12);
    expect(prismaMock.resourceAllocation.findUnique).toHaveBeenCalledWith({
      where: { allocationId: 12 },
      include,
    });
  });

  it("GET returns 404 when the lookup throws", async () => {
    prismaMock.resourceAllocation.findUnique.mockRejectedValue(new Error("boom"));

    expect((await GET_ONE(jsonRequest("GET"), ctx)).status).toBe(404);
  });

  it("PATCH updates only the fields given", async () => {
    // The stored row is read first, so the window it ends up with can be checked.
    prismaMock.resourceAllocation.findUniqueOrThrow.mockResolvedValue(allocation as never);
    prismaMock.resourceAllocation.update.mockResolvedValue(allocation as never);

    await PATCH_ONE(jsonRequest("PATCH", { endTime: "2026-09-06T03:00:00.000Z" }), ctx);

    expect(prismaMock.resourceAllocation.update).toHaveBeenCalledWith({
      where: { allocationId: 12 },
      data: {
        resourceId: undefined,
        startTime: undefined,
        endTime: new Date("2026-09-06T03:00:00.000Z"),
        bookableId: undefined,
      },
      include,
    });
  });

  it("PATCH returns 404 for an unknown allocation", async () => {
    prismaMock.resourceAllocation.findUniqueOrThrow.mockRejectedValue(prismaError("P2025"));

    expect((await PATCH_ONE(jsonRequest("PATCH", { resourceId: 1 }), ctx)).status).toBe(404);
  });

  it("DELETE removes the allocation", async () => {
    prismaMock.resourceAllocation.findUniqueOrThrow.mockResolvedValue(allocation as never);

    const { status, json } = await read(await DELETE_ONE(jsonRequest("DELETE"), ctx));

    expect(status).toBe(200);
    expect(json.message).toBe("Resource allocation deleted successfully");
    expect(prismaMock.resourceAllocation.delete).toHaveBeenCalledWith({
      where: { allocationId: 12 },
    });
  });

  it("DELETE returns 404 for an unknown allocation", async () => {
    prismaMock.resourceAllocation.findUniqueOrThrow.mockRejectedValue(prismaError("P2025"));

    expect((await DELETE_ONE(jsonRequest("DELETE"), ctx)).status).toBe(404);
  });
});
