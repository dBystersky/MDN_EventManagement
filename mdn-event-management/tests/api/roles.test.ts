/**
 * Role-based access: Executive / Manager / Member.
 *
 * The rules themselves live in `lib/permissions.ts`; these tests drive them
 * through the route handlers, which are what actually enforce them.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { GET as LIST_EVENTS, POST as CREATE_EVENT } from "@/app/api/events/route";
import {
  DELETE as DELETE_EVENT,
  GET as GET_EVENT,
  PATCH as PATCH_EVENT,
} from "@/app/api/events/[eventId]/route";
import { GET as LIST_TASKS, POST as CREATE_TASK } from "@/app/api/tasks/route";
import { DELETE as DELETE_TASK, PATCH as PATCH_TASK } from "@/app/api/tasks/[taskId]/route";
import { asAnonymous, asUser } from "../helpers/auth";
import { prismaMock } from "../helpers/prisma";
import { jsonRequest, params, read } from "../helpers/request";

// Event 3 is run by manager 10 and has member 20 on it.
const access = {
  eventManagers: [{ memberId: 10 }],
  eventMembers: [{ memberId: 20 }],
};
const event = {
  eventId: 3,
  name: "Launch night",
  date: new Date("2026-09-06T00:00:00.000Z"),
  endDate: new Date("2026-09-06T02:00:00.000Z"),
  bookableId: 30,
  tasks: [],
  ...access,
};
const task = {
  taskId: 7,
  name: "Order PCB",
  deadline: new Date("2026-09-15T17:00:00.000Z"),
  bookableId: 70,
  eventId: 3,
  budget: null,
  status: "backlog",
  taskManagers: [],
};

const executive = () => asUser("Executive", { member_id: 1 });
const manager = (id = 10) => asUser("Manager", { member_id: id });
const member = (id = 20) => asUser("Member", { member_id: id });

const eventCtx = params({ eventId: "3" });
const taskCtx = params({ taskId: "7" });
const taskBody = { name: "Order PCB", deadline: "2026-09-15T17:00:00.000Z" };

describe("sign-in", () => {
  it("is required on every events and tasks route", async () => {
    asAnonymous();
    const statuses = [
      (await LIST_EVENTS()).status,
      (await CREATE_EVENT(jsonRequest("POST", {}))).status,
      (await GET_EVENT(jsonRequest("GET"), eventCtx)).status,
      (await PATCH_EVENT(jsonRequest("PATCH", {}), eventCtx)).status,
      (await DELETE_EVENT(jsonRequest("DELETE"), eventCtx)).status,
      (await LIST_TASKS(jsonRequest("GET"))).status,
      (await CREATE_TASK(jsonRequest("POST", taskBody))).status,
      (await PATCH_TASK(jsonRequest("PATCH", {}), taskCtx)).status,
      (await DELETE_TASK(jsonRequest("DELETE"), taskCtx)).status,
    ];
    expect(statuses).toEqual(Array(9).fill(401));
  });
});

describe("events", () => {
  describe("viewing", () => {
    it.each([
      ["Executive", executive],
      ["Manager", manager],
    ])("lets a %s see every event", async (_role, signIn) => {
      signIn();
      prismaMock.event.findMany.mockResolvedValue([event] as never);

      await LIST_EVENTS();

      expect(prismaMock.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: undefined }),
      );
    });

    it("narrows a Member's list to the events they belong to", async () => {
      member(20);
      prismaMock.event.findMany.mockResolvedValue([] as never);

      await LIST_EVENTS();

      expect(prismaMock.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { eventMembers: { some: { memberId: 20 } } } }),
      );
    });

    it("lets a Member open their event but not someone else's", async () => {
      prismaMock.event.findUnique.mockResolvedValue(event as never);

      member(20);
      expect((await GET_EVENT(jsonRequest("GET"), eventCtx)).status).toBe(200);

      member(21);
      expect((await GET_EVENT(jsonRequest("GET"), eventCtx)).status).toBe(403);
    });

    it("lets a Manager open an event they do not manage", async () => {
      manager(99);
      prismaMock.event.findUnique.mockResolvedValue(event as never);

      expect((await GET_EVENT(jsonRequest("GET"), eventCtx)).status).toBe(200);
    });
  });

  describe("creating and deleting", () => {
    const body = {
      name: "Gala",
      date: "2026-10-01T10:00:00.000Z",
      endDate: "2026-10-01T12:00:00.000Z",
      locationId: 1,
    };

    it.each([
      ["Manager", manager],
      ["Member", member],
    ])("refuses a %s", async (_role, signIn) => {
      signIn();

      expect((await CREATE_EVENT(jsonRequest("POST", body))).status).toBe(403);
      expect((await DELETE_EVENT(jsonRequest("DELETE"), eventCtx)).status).toBe(403);
      expect(prismaMock.event.create).not.toHaveBeenCalled();
    });

    it("lets an Executive create and delete", async () => {
      executive();
      prismaMock.event.create.mockResolvedValue({ ...event, eventId: 4 } as never);
      prismaMock.event.findUniqueOrThrow.mockResolvedValue({ bookableId: 30 } as never);

      expect((await CREATE_EVENT(jsonRequest("POST", body))).status).toBe(201);
      expect((await DELETE_EVENT(jsonRequest("DELETE"), eventCtx)).status).toBe(200);
    });
  });

  describe("updating", () => {
    function existing() {
      prismaMock.event.findUnique.mockResolvedValueOnce(access as never);
      prismaMock.event.findUniqueOrThrow
        .mockResolvedValueOnce({
          date: event.date,
          endDate: event.endDate,
          bookableId: 30,
        } as never)
        .mockResolvedValueOnce(event as never);
    }

    it("lets a Manager edit an event they manage", async () => {
      manager(10);
      existing();

      const { status } = await read(
        await PATCH_EVENT(jsonRequest("PATCH", { name: "Renamed" }), eventCtx),
      );

      expect(status).toBe(200);
    });

    it("refuses a Manager on an event they do not manage", async () => {
      manager(99);
      prismaMock.event.findUnique.mockResolvedValueOnce(access as never);

      const { status } = await read(
        await PATCH_EVENT(jsonRequest("PATCH", { name: "Renamed" }), eventCtx),
      );

      expect(status).toBe(403);
      expect(prismaMock.event.update).not.toHaveBeenCalled();
    });

    it("refuses a Member", async () => {
      member(20);
      prismaMock.event.findUnique.mockResolvedValueOnce(access as never);

      expect((await PATCH_EVENT(jsonRequest("PATCH", { name: "x" }), eventCtx)).status).toBe(403);
    });

    it("lets a Manager assign members but not change the event's managers", async () => {
      manager(10);
      existing();
      expect(
        (await PATCH_EVENT(jsonRequest("PATCH", { memberIds: [20, 21] }), eventCtx)).status,
      ).toBe(200);
      const { data } = prismaMock.event.update.mock.calls[0][0];
      expect(data.eventMembers).toMatchObject({
        deleteMany: {},
        create: [{ memberId: 20 }, { memberId: 21 }],
      });

      prismaMock.event.findUnique.mockResolvedValueOnce(access as never);
      expect(
        (await PATCH_EVENT(jsonRequest("PATCH", { managerIds: [10, 11] }), eventCtx)).status,
      ).toBe(403);
    });

    it("lets an Executive change managers", async () => {
      executive();
      existing();

      expect(
        (await PATCH_EVENT(jsonRequest("PATCH", { managerIds: [10, 11] }), eventCtx)).status,
      ).toBe(200);
    });
  });
});

describe("tasks", () => {
  beforeEach(() => {
    // Event budget roll-up after a write.
    prismaMock.task.aggregate.mockResolvedValue({ _sum: { budget: null } } as never);
  });

  describe("viewing", () => {
    it("narrows a Member's list to their events and their own assignments", async () => {
      member(20);
      prismaMock.task.findMany.mockResolvedValue([] as never);

      await LIST_TASKS(jsonRequest("GET"));

      expect(prismaMock.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { event: { eventMembers: { some: { memberId: 20 } } } },
              { taskManagers: { some: { memberId: 20 } } },
            ],
          },
        }),
      );
    });

    it("does not narrow a Manager's list", async () => {
      manager();
      prismaMock.task.findMany.mockResolvedValue([] as never);

      await LIST_TASKS(jsonRequest("GET"));

      expect(prismaMock.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: undefined }),
      );
    });
  });

  describe("creating", () => {
    it("lets a Member create a task in their event, unassigned", async () => {
      member(20);
      prismaMock.event.findUnique.mockResolvedValue(access as never);
      prismaMock.task.create.mockResolvedValue(task as never);

      const { status } = await read(
        await CREATE_TASK(jsonRequest("POST", { ...taskBody, eventId: 3 })),
      );

      expect(status).toBe(201);
    });

    it("refuses a Member outside the event, or with no event", async () => {
      member(21);
      prismaMock.event.findUnique.mockResolvedValue(access as never);

      expect((await CREATE_TASK(jsonRequest("POST", { ...taskBody, eventId: 3 }))).status).toBe(
        403,
      );
      expect((await CREATE_TASK(jsonRequest("POST", taskBody))).status).toBe(403);
      expect(prismaMock.task.create).not.toHaveBeenCalled();
    });

    it("refuses a Member assigning people to the task", async () => {
      member(20);
      prismaMock.event.findUnique.mockResolvedValue(access as never);

      const { status } = await read(
        await CREATE_TASK(jsonRequest("POST", { ...taskBody, eventId: 3, managerIds: [5] })),
      );

      expect(status).toBe(403);
    });

    it("lets a Manager create a task, assigned or not, in an event they manage", async () => {
      manager(10);
      prismaMock.event.findUnique.mockResolvedValue(access as never);
      prismaMock.task.create.mockResolvedValue(task as never);

      for (const managerIds of [undefined, [5]]) {
        const { status } = await read(
          await CREATE_TASK(jsonRequest("POST", { ...taskBody, eventId: 3, managerIds })),
        );
        expect(status).toBe(201);
      }
    });

    it("refuses a Manager creating a task in an event they do not manage", async () => {
      manager(99);
      prismaMock.event.findUnique.mockResolvedValue(access as never);

      const { status } = await read(
        await CREATE_TASK(jsonRequest("POST", { ...taskBody, eventId: 3 })),
      );

      expect(status).toBe(403);
    });

    it("lets Executives and Managers set a budget, but not Members", async () => {
      prismaMock.event.findUnique.mockResolvedValue(access as never);
      prismaMock.task.create.mockResolvedValue(task as never);
      const body = { ...taskBody, eventId: 3, budget: 100 };

      member(20);
      expect((await CREATE_TASK(jsonRequest("POST", body))).status).toBe(403);

      manager(10);
      expect((await CREATE_TASK(jsonRequest("POST", body))).status).toBe(201);

      executive();
      expect((await CREATE_TASK(jsonRequest("POST", body))).status).toBe(201);
    });

    it("rejects an unknown status", async () => {
      executive();

      const { status } = await read(
        await CREATE_TASK(jsonRequest("POST", { ...taskBody, status: "finished" })),
      );

      expect(status).toBe(400);
    });
  });

  describe("updating", () => {
    function existing(overrides: object = {}) {
      prismaMock.task.findUnique.mockResolvedValueOnce({
        eventId: 3,
        taskManagers: [],
        ...overrides,
      } as never);
      prismaMock.event.findUnique.mockResolvedValueOnce(access as never);
      prismaMock.task.findUniqueOrThrow.mockResolvedValue({
        eventId: 3,
        deadline: task.deadline,
        bookableId: 70,
      } as never);
      prismaMock.task.update.mockResolvedValue(task as never);
    }

    it.each(["backlog", "ready_to_do", "in_progress", "blocked", "done"])(
      "lets a Member in the event set the status to %s",
      async (status) => {
        member(20);
        existing();

        const res = await PATCH_TASK(jsonRequest("PATCH", { status }), taskCtx);

        expect(res.status).toBe(200);
        expect(prismaMock.task.update.mock.calls[0][0].data.status).toBe(status);
      },
    );

    it("lets a Member change name, description and deadline", async () => {
      member(20);
      existing();
      prismaMock.resourceAllocation.findMany.mockResolvedValue([] as never);

      const res = await PATCH_TASK(
        jsonRequest("PATCH", { name: "New", description: "d", deadline: "2026-09-20T00:00:00Z" }),
        taskCtx,
      );

      expect(res.status).toBe(200);
    });

    it("lets a Member update a task they are assigned to in another event", async () => {
      member(21);
      existing({ taskManagers: [{ memberId: 21 }] });

      expect((await PATCH_TASK(jsonRequest("PATCH", { status: "done" }), taskCtx)).status).toBe(
        200,
      );
    });

    it("refuses a Member outside the event", async () => {
      member(21);
      existing();

      expect((await PATCH_TASK(jsonRequest("PATCH", { status: "done" }), taskCtx)).status).toBe(
        403,
      );
      expect(prismaMock.task.update).not.toHaveBeenCalled();
    });

    it.each([
      ["assignees", { managerIds: [5] }],
      ["event", { eventId: null }],
      ["budget", { budget: 10 }],
    ])("stops a Member changing the %s", async (_what, body) => {
      member(20);
      existing();

      expect((await PATCH_TASK(jsonRequest("PATCH", body), taskCtx)).status).toBe(403);
      expect(prismaMock.task.update).not.toHaveBeenCalled();
    });

    it("lets a Manager of the event assign people", async () => {
      manager(10);
      existing();

      expect((await PATCH_TASK(jsonRequest("PATCH", { managerIds: [5] }), taskCtx)).status).toBe(
        200,
      );
    });

    it("stops a Manager changing a task in an event they do not manage", async () => {
      manager(99);
      existing();

      expect((await PATCH_TASK(jsonRequest("PATCH", { status: "done" }), taskCtx)).status).toBe(
        403,
      );
    });

    it("stops a Manager moving a task into an event they do not manage", async () => {
      manager(10);
      existing();
      prismaMock.event.findUnique.mockResolvedValueOnce({
        eventManagers: [{ memberId: 77 }],
        eventMembers: [],
      } as never);

      expect((await PATCH_TASK(jsonRequest("PATCH", { eventId: 4 }), taskCtx)).status).toBe(403);
    });

    it("lets a Manager change a budget on their event's task, but not elsewhere", async () => {
      manager(99);
      existing();
      expect((await PATCH_TASK(jsonRequest("PATCH", { budget: 10 }), taskCtx)).status).toBe(403);

      manager(10);
      existing();
      expect((await PATCH_TASK(jsonRequest("PATCH", { budget: 10 }), taskCtx)).status).toBe(200);

      executive();
      existing();
      expect((await PATCH_TASK(jsonRequest("PATCH", { budget: 10 }), taskCtx)).status).toBe(200);
    });

    it("rejects an unknown status", async () => {
      executive();
      existing();

      expect((await PATCH_TASK(jsonRequest("PATCH", { status: "nope" }), taskCtx)).status).toBe(
        400,
      );
    });
  });

  describe("deleting", () => {
    function existing() {
      prismaMock.task.findUnique.mockResolvedValue({
        ...task,
        taskManagers: [{ memberId: 20 }],
      } as never);
      prismaMock.event.findUnique.mockResolvedValue(access as never);
      prismaMock.task.findUniqueOrThrow.mockResolvedValue({ bookableId: 70, eventId: 3 } as never);
    }

    it("refuses a Member even on a task assigned to them", async () => {
      member(20);
      existing();

      expect((await DELETE_TASK(jsonRequest("DELETE"), taskCtx)).status).toBe(403);
    });

    it("refuses a Manager of a different event", async () => {
      manager(99);
      existing();

      expect((await DELETE_TASK(jsonRequest("DELETE"), taskCtx)).status).toBe(403);
    });

    it("lets a Manager of the event, and an Executive", async () => {
      existing();
      manager(10);
      expect((await DELETE_TASK(jsonRequest("DELETE"), taskCtx)).status).toBe(200);

      executive();
      expect((await DELETE_TASK(jsonRequest("DELETE"), taskCtx)).status).toBe(200);
    });
  });
});
