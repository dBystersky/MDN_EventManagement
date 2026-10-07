import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/audit-logs/route";
import { POST as createTask } from "@/app/api/tasks/route";
import { PATCH as patchTask } from "@/app/api/tasks/[taskId]/route";
import { prismaMock } from "../helpers/prisma";
import { asAnonymous, asUser } from "../helpers/auth";
import { jsonRequest, params, read } from "../helpers/request";

const deadline = new Date("2026-09-15T17:00:00.000Z");
const task = {
  taskId: 7,
  name: "Order PCB",
  deadline,
  bookableId: 70,
  eventId: null,
  taskManagers: [],
};

describe("GET /api/audit-logs", () => {
  it("requires sign-in", async () => {
    asAnonymous();
    expect((await GET(jsonRequest("GET"))).status).toBe(401);
  });

  it.each(["Member", "Manager", "Guest"] as const)("is closed to %s accounts", async (role) => {
    asUser("Member", { role });
    expect((await GET(jsonRequest("GET"))).status).toBe(403);
  });

  it("lists entries newest first for admins, with filters", async () => {
    asUser("Admin");
    prismaMock.auditLog.findMany.mockResolvedValue([{ auditId: 1 }] as never);

    const { status, json } = await read(
      await GET(
        jsonRequest("GET", undefined, "http://localhost/api/audit-logs?entityType=Task&entityId=7"),
      ),
    );

    expect(status).toBe(200);
    expect(json).toHaveLength(1);
    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith({
      where: { entityType: "Task", entityId: 7 },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  });
});

describe("recording changes", () => {
  beforeEach(() => {
    asUser("Manager", { member_id: 1, name: "Pat" });
    prismaMock.task.create.mockResolvedValue(task as never);
  });

  it("stores the entry in the database", async () => {
    const { status } = await read(
      await createTask(
        jsonRequest("POST", { name: "Order PCB", deadline: deadline.toISOString() }),
      ),
    );

    expect(status).toBe(201);
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 1,
        actorName: "Pat",
        action: "create",
        entityType: "Task",
        entityId: 7,
      }),
    });
  });

  it("records which fields an update touched", async () => {
    prismaMock.task.findUniqueOrThrow.mockResolvedValue({ eventId: null } as never);
    prismaMock.task.update.mockResolvedValue(task as never);

    await patchTask(
      jsonRequest("PATCH", { name: "Order PCB v2", budget: 5 }),
      params({ taskId: "7" }),
    );

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "update", changes: { fields: ["name", "budget"] } }),
    });
  });

  it("still succeeds when the audit write fails", async () => {
    prismaMock.auditLog.create.mockRejectedValue(new Error("db down"));

    const { status } = await read(
      await createTask(jsonRequest("POST", { name: "x", deadline: deadline.toISOString() })),
    );

    expect(status).toBe(201);
  });
});

describe("coverage of the remaining areas", () => {
  beforeEach(() => asUser("Admin", { member_id: 2, name: "Ada" }));

  it("logs resource, resource type and location changes", async () => {
    const { POST: createResource } = await import("@/app/api/resources/route");
    const { DELETE: deleteType } = await import("@/app/api/resource-types/[typeId]/route");
    const { PATCH: renameLocation } = await import("@/app/api/locations/[locationId]/route");
    prismaMock.resource.create.mockResolvedValue({ resourceId: 4, name: "Projector" } as never);
    prismaMock.resourceType.findUnique.mockResolvedValue({ typeId: 9, name: "AV" } as never);
    prismaMock.resourceType.findUniqueOrThrow.mockResolvedValue({ typeId: 9 } as never);
    prismaMock.resource.findMany.mockResolvedValue([{ resourceId: 4, name: "Projector" }] as never);
    prismaMock.resourceAllocation.findMany.mockResolvedValue([
      { allocationId: 12, resourceId: 4 },
    ] as never);
    prismaMock.location.update.mockResolvedValue({ locationId: 3, name: "Hall B" } as never);

    await createResource(jsonRequest("POST", { name: "Projector", resourceTypeId: 9 }));
    await deleteType(jsonRequest("DELETE"), params({ typeId: "9" }));
    await renameLocation(jsonRequest("PATCH", { name: "Hall B" }), params({ locationId: "3" }));

    const rows = prismaMock.auditLog.create.mock.calls.map((c) => c[0].data);
    expect(rows).toEqual([
      expect.objectContaining({
        entityType: "Resource",
        action: "create",
        entityId: 4,
        actorName: "Ada",
      }),
      expect.objectContaining({ entityType: "ResourceAllocation", action: "delete", entityId: 12 }),
      expect.objectContaining({ entityType: "Resource", action: "delete", entityId: 4 }),
      expect.objectContaining({
        entityType: "ResourceType",
        action: "delete",
        summary: 'Deleted resource type "AV"',
      }),
      expect.objectContaining({ entityType: "Location", action: "update", entityId: 3 }),
    ]);
  });

  it("logs member creation and deletion without the password", async () => {
    const { POST } = await import("@/app/api/admin/members/route");
    const { DELETE } = await import("@/app/api/admin/members/[id]/route");
    prismaMock.member.findUnique.mockResolvedValueOnce(null as never);
    prismaMock.member.create.mockResolvedValue({
      memberId: 8,
      name: "Bo",
      email: "bo@x.com",
      role: "Manager",
    } as never);

    await POST(
      jsonRequest("POST", { name: "Bo", email: "bo@x.com", password: "s3cret!!", role: "Manager" }),
    );
    prismaMock.member.findUnique.mockResolvedValueOnce({
      name: "Bo",
      email: "bo@x.com",
      role: "Manager",
    } as never);
    await DELETE(jsonRequest("DELETE"), params({ id: "8" }));

    const rows = prismaMock.auditLog.create.mock.calls.map((c) => c[0].data);
    expect(rows).toHaveLength(2);
    expect(rows[0].summary).toBe("Created Manager account for Bo <bo@x.com>");
    expect(rows[1]).toMatchObject({ action: "delete", entityType: "Member", entityId: 8 });
    expect(JSON.stringify(rows)).not.toContain("s3cret");
  });

  it("logs failed logins without recording the password", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    asAnonymous();
    prismaMock.member.findUnique.mockResolvedValue(null as never);

    const { status } = await read(
      await POST(jsonRequest("POST", { email: "x@y.com", password: "hunter2" })),
    );

    expect(status).toBe(401);
    const [{ data }] = prismaMock.auditLog.create.mock.calls[0];
    expect(data).toMatchObject({ action: "login_failed", actorId: null });
    expect(JSON.stringify(data)).not.toContain("hunter2");
  });
});
