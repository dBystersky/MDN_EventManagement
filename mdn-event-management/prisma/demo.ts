/**
 * Wipes the database and fills it with demo data, so every page looks like
 * the app is in real use: members of every role, venues, resources, a
 * semester of events with their tasks and bookings, and a backdated audit log.
 *
 * Run with:  npm run db:demo           (asks before wiping)
 *            npm run db:demo -- --yes  (no prompt)
 *
 * Every date is relative to when the script runs, so there is always recent
 * history, something on this week and upcoming events. The content is fixed —
 * no randomness — so every run produces the same data.
 *
 * Two clashes are planted on purpose, for the conflict flags to show:
 *   - "Research Project Showcase" and "Sponsor Info Session" overlap in the
 *     same lecture theatre;
 *   - "Projector A" is booked by the RL workshop and by an AGM rehearsal task
 *     at the same time.
 */

import bcrypt from "bcryptjs";
import type { Prisma } from "../generated/prisma/client";
import { DEFAULT_BOOKING_DURATION_MS } from "../lib/datetime";
import { confirmWipe, createAdmin, run, wipeDatabase, type Db } from "./seed-utils";

const DEMO_PASSWORD = "demo1234";

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const NOW = new Date();
const TODAY = new Date(NOW);
TODAY.setHours(0, 0, 0, 0);

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Local time `dayOffset` days from today. `setDate` keeps DST changes right. */
function at(dayOffset: number, hour: number, minute = 0) {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** Audit entries cannot be from the future; pull any that would be back to just before now. */
function inPast(d: Date, fallbackMinutesAgo = 30) {
  return d < NOW ? d : new Date(NOW.getTime() - fallbackMinutesAgo * 60 * 1000);
}

function plus(d: Date, ms: number) {
  return new Date(d.getTime() + ms);
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

type Role = "Member" | "Manager" | "Admin" | "Guest";

const MEMBERS: { key: string; name: string; role: Role }[] = [
  { key: "priya", name: "Priya Raman", role: "Manager" },
  { key: "lachlan", name: "Lachlan Nguyen", role: "Manager" },
  { key: "aisha", name: "Aisha Karim", role: "Manager" },
  { key: "ethan", name: "Ethan Wong", role: "Member" },
  { key: "sophie", name: "Sophie Tran", role: "Member" },
  { key: "mateo", name: "Mateo Rossi", role: "Member" },
  { key: "hannah", name: "Hannah Lee", role: "Member" },
  { key: "arjun", name: "Arjun Mehta", role: "Member" },
  { key: "chloe", name: "Chloe Bennett", role: "Member" },
  { key: "daniel", name: "Daniel Kim", role: "Member" },
  { key: "olivia", name: "Olivia Hart", role: "Guest" },
];

const LOCATIONS: { key: string; name: string }[] = [
  { key: "lab", name: "MDN Lab, Woodside Building G.24" },
  { key: "theatre", name: "Lecture Theatre S3, 16 Rainforest Walk" },
  { key: "seminar", name: "Seminar Room 1.42, Learning & Teaching Building" },
  { key: "hall", name: "Campus Centre Main Hall" },
  { key: "caulfield", name: "Caulfield H-Building H1.16" },
  { key: "zoom", name: "Online (Zoom)" },
];

const RESOURCE_TYPES: { name: string; resources: { key: string; name: string }[] }[] = [
  {
    name: "Projector",
    resources: [
      { key: "projA", name: "Projector A" },
      { key: "projB", name: "Projector B" },
    ],
  },
  {
    name: "Laptop",
    resources: [
      { key: "laptop1", name: "Loaner Laptop 1" },
      { key: "laptop2", name: "Loaner Laptop 2" },
      { key: "laptop3", name: "Loaner Laptop 3" },
    ],
  },
  {
    name: "GPU Server",
    resources: [
      { key: "gpu1", name: "RTX 4090 Node 1" },
      { key: "gpu2", name: "RTX 4090 Node 2" },
      { key: "a100", name: "A100 Cloud Instance" },
    ],
  },
  {
    name: "Audio",
    resources: [
      { key: "mic", name: "Wireless Mic Kit" },
      { key: "pa", name: "PA Speaker" },
    ],
  },
  {
    name: "Camera",
    resources: [
      { key: "camera", name: "Sony ZV-E10 Camera" },
      { key: "tripod", name: "Tripod Set" },
    ],
  },
  {
    name: "Signage",
    resources: [
      { key: "banner", name: "Pull-up Banner" },
      { key: "stall", name: "Club Stall Kit" },
    ],
  },
];

type TaskSpec = {
  name: string;
  description: string;
  deadline: Date;
  budget?: number;
  managers: string[];
  resources?: string[];
};

type EventSpec = {
  name: string;
  description: string;
  start: Date;
  end: Date;
  location: string;
  managers: string[];
  resources: string[];
  tasks: TaskSpec[];
  /** Logged as an edit a few days after creation. */
  edited?: string[];
};

const EVENTS: EventSpec[] = [
  {
    name: "Clubs & Societies Day Stall",
    description: "Recruitment stall for new members. Bring sign-up laptop and demo notebooks.",
    start: at(-58, 10),
    end: at(-58, 15),
    location: "hall",
    managers: ["priya", "sophie"],
    resources: ["stall", "banner", "laptop1"],
    tasks: [
      {
        name: "Print recruitment flyers",
        description: "500 A5 flyers with the QR code to the sign-up form.",
        deadline: at(-61, 17),
        budget: 120,
        managers: ["sophie"],
      },
      {
        name: "Roster stall volunteers",
        description: "Two people per hour-long shift.",
        deadline: at(-60, 12),
        managers: ["priya"],
      },
      {
        name: "Buy lollies for the stall",
        description: "",
        deadline: at(-59, 16),
        budget: 45,
        managers: ["hannah"],
      },
    ],
  },
  {
    name: "Welcome Night & General Meeting",
    description: "Intro to MDN, this semester's research teams, and how to get involved.",
    start: at(-50, 18),
    end: at(-50, 20, 30),
    location: "theatre",
    managers: ["priya"],
    resources: ["projA", "mic"],
    edited: ["description"],
    tasks: [
      {
        name: "Order pizza",
        description: "Expecting about 80 people — include vegetarian and gluten-free.",
        deadline: at(-51, 15),
        budget: 260,
        managers: ["hannah"],
      },
      {
        name: "Prepare welcome slides",
        description: "Team overviews from each project lead.",
        deadline: at(-52, 20),
        managers: ["priya", "lachlan"],
      },
    ],
  },
  {
    name: "Intro to PyTorch #1: Tensors & Autograd",
    description: "First workshop of the series. No prior ML experience needed.",
    start: at(-42, 18),
    end: at(-42, 20),
    location: "seminar",
    managers: ["lachlan"],
    resources: ["projB", "laptop1", "laptop2", "laptop3"],
    tasks: [
      {
        name: "Write workshop 1 notebook",
        description: "Colab notebook with exercises and solutions.",
        deadline: at(-45, 20),
        managers: ["ethan"],
      },
      {
        name: "Set up loaner laptops",
        description: "Install conda env and pre-download datasets.",
        deadline: at(-43, 15),
        managers: ["daniel"],
        resources: ["laptop1", "laptop2", "laptop3"],
      },
    ],
  },
  {
    name: "Intro to PyTorch #2: Training Loops",
    description: "Datasets, dataloaders, optimisers and writing a clean training loop.",
    start: at(-35, 18),
    end: at(-35, 20),
    location: "seminar",
    managers: ["lachlan"],
    resources: ["projB", "laptop1", "laptop2", "laptop3"],
    tasks: [
      {
        name: "Write workshop 2 notebook",
        description: "MNIST end-to-end, with a broken loop to debug.",
        deadline: at(-38, 20),
        managers: ["ethan", "mateo"],
      },
    ],
  },
  {
    name: "Paper Reading Group: Attention Is All You Need",
    description: "Walkthrough of the original transformer paper.",
    start: at(-30, 13),
    end: at(-30, 14),
    location: "zoom",
    managers: ["aisha"],
    resources: [],
    tasks: [
      {
        name: "Prepare transformer paper summary",
        description: "One-page summary and discussion questions.",
        deadline: at(-31, 18),
        managers: ["arjun"],
      },
    ],
  },
  {
    name: "Intro to PyTorch #3: CNNs",
    description: "Convolutions, pooling and training an image classifier on CIFAR-10.",
    start: at(-28, 18),
    end: at(-28, 20),
    location: "seminar",
    managers: ["lachlan", "ethan"],
    resources: ["projB", "laptop1", "laptop2", "laptop3"],
    tasks: [
      {
        name: "Write workshop 3 notebook",
        description: "CIFAR-10 classifier with augmentation exercises.",
        deadline: at(-31, 20),
        managers: ["mateo"],
      },
    ],
  },
  {
    name: "Industry Night",
    description: "Panel and networking with ML engineers from our sponsors.",
    start: at(-20, 18),
    end: at(-20, 21),
    location: "hall",
    managers: ["priya", "aisha"],
    resources: ["projA", "mic", "pa", "camera", "banner"],
    edited: ["date", "endDate"],
    tasks: [
      {
        name: "Confirm panel speakers",
        description: "Four speakers confirmed in writing, with bios and headshots.",
        deadline: at(-30, 17),
        managers: ["aisha"],
      },
      {
        name: "Order catering",
        description: "Finger food and drinks for 120.",
        deadline: at(-25, 12),
        budget: 650,
        managers: ["hannah", "chloe"],
      },
      {
        name: "Print name tags",
        description: "",
        deadline: at(-22, 17),
        budget: 60,
        managers: ["chloe"],
      },
      {
        name: "Test AV setup",
        description: "Run through slides and mics in the hall the day before.",
        deadline: at(-21, 16),
        managers: ["daniel"],
        resources: ["projA", "mic"],
      },
    ],
  },
  {
    name: "Paper Reading Group: Denoising Diffusion Models",
    description: "DDPM and where diffusion models went next.",
    start: at(-9, 13),
    end: at(-9, 14),
    location: "zoom",
    managers: ["aisha"],
    resources: [],
    tasks: [
      {
        name: "Prepare diffusion paper summary",
        description: "",
        deadline: at(-10, 18),
        managers: ["sophie"],
      },
    ],
  },
  {
    name: "NeuroHack 2026",
    description: "48-hour hackathon. Teams of 3–4, GPU time provided, prizes for the top three.",
    start: at(-1, 9),
    end: at(1, 17),
    location: "lab",
    managers: ["lachlan", "priya"],
    resources: ["gpu1", "gpu2", "a100", "projB", "laptop1", "laptop2"],
    edited: ["description"],
    tasks: [
      {
        name: "Secure prizes",
        description: "Cash and hardware prizes from sponsors.",
        deadline: at(-14, 17),
        budget: 1200,
        managers: ["aisha"],
      },
      {
        name: "Publish problem statements",
        description: "Three tracks: vision, NLP, and open.",
        deadline: at(-7, 12),
        managers: ["lachlan", "arjun"],
      },
      {
        name: "Order hackathon catering",
        description: "Lunch and dinner both days, plus snacks overnight.",
        deadline: at(-4, 12),
        budget: 900,
        managers: ["hannah"],
      },
      {
        name: "Recruit judges",
        description: "Two academics and two industry judges.",
        deadline: at(-6, 17),
        managers: ["priya"],
      },
      {
        name: "Provision GPU accounts",
        description: "One account per team on the lab nodes and the cloud instance.",
        deadline: at(-2, 10),
        managers: ["daniel", "ethan"],
        resources: ["gpu1", "gpu2", "a100"],
      },
    ],
  },
  {
    name: "Paper Reading Group: Mixture of Experts",
    description: "Switch Transformer and sparse MoE routing.",
    start: at(5, 13),
    end: at(5, 14),
    location: "zoom",
    managers: ["aisha"],
    resources: [],
    tasks: [
      {
        name: "Prepare MoE paper summary",
        description: "",
        deadline: at(4, 18),
        managers: ["arjun"],
      },
    ],
  },
  {
    name: "Research Project Showcase",
    description: "Each research team presents its semester results. Open to the public.",
    start: at(12, 17),
    end: at(12, 20),
    location: "theatre",
    managers: ["priya", "lachlan"],
    resources: ["projA", "mic", "camera"],
    tasks: [
      {
        name: "Collect project abstracts",
        description: "200 words per team for the programme.",
        deadline: at(5, 17),
        managers: ["sophie"],
      },
      {
        name: "Print posters",
        description: "A1 posters, one per team.",
        deadline: at(9, 12),
        budget: 300,
        managers: ["chloe"],
      },
      {
        name: "Film showcase teaser",
        description: "30-second promo for socials.",
        deadline: at(8, 14),
        managers: ["mateo"],
        resources: ["camera", "tripod"],
      },
      {
        name: "Order drinks & snacks",
        description: "",
        deadline: at(11, 12),
        budget: 200,
        managers: ["hannah"],
      },
    ],
  },
  {
    // Planted venue clash: same theatre, overlaps the showcase 18:30–19:30.
    name: "Sponsor Info Session",
    description: "Sponsors present internship opportunities.",
    start: at(12, 18, 30),
    end: at(12, 19, 30),
    location: "theatre",
    managers: ["aisha"],
    resources: ["projB"],
    tasks: [
      {
        name: "Send sponsor invitations",
        description: "",
        deadline: at(3, 17),
        managers: ["aisha"],
      },
    ],
  },
  {
    name: "Intro to Reinforcement Learning Workshop",
    description: "Bandits, Q-learning and a CartPole agent in an evening.",
    start: at(19, 18),
    end: at(19, 20),
    location: "seminar",
    managers: ["ethan"],
    resources: ["projA", "laptop1", "laptop2", "laptop3"],
    tasks: [
      {
        name: "Write RL workshop notebook",
        description: "Gymnasium CartPole with a tabular Q-learning baseline.",
        deadline: at(16, 20),
        managers: ["ethan", "arjun"],
      },
    ],
  },
  {
    name: "Annual General Meeting",
    description: "Annual reports, constitution amendments, and committee elections.",
    start: at(33, 18),
    end: at(33, 20),
    location: "theatre",
    managers: ["priya"],
    resources: ["projB", "mic"],
    tasks: [
      {
        name: "Call for committee nominations",
        description: "Nominations close one week before the AGM.",
        deadline: at(26, 17),
        managers: ["priya"],
      },
      {
        name: "Prepare treasurer's report",
        description: "",
        deadline: at(30, 17),
        managers: ["chloe"],
      },
      {
        // Planted resource clash: Projector A is with the RL workshop then.
        name: "Rehearse AGM presentations",
        description: "Run-through with the outgoing committee.",
        deadline: at(19, 18, 30),
        managers: ["priya", "lachlan"],
        resources: ["projA"],
      },
    ],
  },
  {
    name: "End-of-Year Social",
    description: "Celebrate the semester. Members and plus-ones welcome.",
    start: at(44, 18),
    end: at(44, 22),
    location: "caulfield",
    managers: ["hannah", "sophie"],
    resources: ["pa"],
    tasks: [
      {
        name: "Pay venue deposit",
        description: "",
        deadline: at(30, 17),
        budget: 500,
        managers: ["hannah"],
      },
      {
        name: "Order merch giveaways",
        description: "Stickers and tote bags.",
        deadline: at(35, 17),
        budget: 350,
        managers: ["sophie"],
      },
    ],
  },
];

const STANDALONE_TASKS: TaskSpec[] = [
  {
    name: "Equipment inventory check",
    description: "Count and test everything in the lab cupboard.",
    deadline: at(-14, 12),
    managers: ["daniel"],
  },
  {
    name: "Update club website",
    description: "Add this semester's events and team pages.",
    deadline: at(7, 23),
    managers: ["mateo"],
  },
  {
    name: "Renew cloud GPU credits",
    description: "Apply for the next round of research credits.",
    deadline: at(10, 17),
    managers: ["lachlan"],
  },
  {
    name: "Submit semester grant application",
    description: "Student union club grant for next semester.",
    deadline: at(15, 17),
    budget: 0,
    managers: ["chloe", "priya"],
  },
];

// ---------------------------------------------------------------------------
// Writing it
// ---------------------------------------------------------------------------

type Actor = { memberId: number; name: string; email: string };

type AuditEntry = {
  createdAt: Date;
  actor: Actor | null;
  action: string;
  entityType: string;
  entityId: number;
  summary: string;
  changes?: Prisma.InputJsonValue;
};

function lookup(map: Map<string, number>, key: string) {
  const id = map.get(key);
  if (id === undefined) throw new Error(`Demo data refers to unknown key "${key}"`);
  return id;
}

async function populate(tx: Db, passwordHash: string) {
  const audit: AuditEntry[] = [];
  const log = (entry: AuditEntry) => audit.push({ ...entry, createdAt: inPast(entry.createdAt) });

  const admin = await createAdmin(tx);

  // Members — created by the admin on day one.
  const memberIds = new Map<string, number>();
  const actors = new Map<string, Actor>();
  for (const [i, m] of MEMBERS.entries()) {
    const [first, last] = m.name.toLowerCase().split(" ");
    const member = await tx.member.create({
      data: {
        name: m.name,
        email: `${first}.${last}@mdn.com`,
        password: passwordHash,
        role: m.role,
      },
    });
    memberIds.set(m.key, member.memberId);
    actors.set(m.key, member);
    log({
      createdAt: plus(at(-75, 10), i * 4 * 60 * 1000),
      actor: admin,
      action: "create",
      entityType: "Member",
      entityId: member.memberId,
      summary: `Created ${member.role} account for ${member.name} <${member.email}>`,
    });
  }
  const actor = (key: string) => actors.get(key)!;

  // Locations, resource types and resources — set up by a manager in week one.
  const setupBy = actor("lachlan");
  let setupAt = at(-72, 14);
  const nextSetup = () => (setupAt = plus(setupAt, 3 * 60 * 1000));

  const locationIds = new Map<string, number>();
  for (const l of LOCATIONS) {
    const location = await tx.location.create({ data: { name: l.name } });
    locationIds.set(l.key, location.locationId);
    log({
      createdAt: nextSetup(),
      actor: setupBy,
      action: "create",
      entityType: "Location",
      entityId: location.locationId,
      summary: `Created location "${location.name}"`,
    });
  }

  const resourceIds = new Map<string, number>();
  for (const t of RESOURCE_TYPES) {
    const type = await tx.resourceType.create({ data: { name: t.name } });
    log({
      createdAt: nextSetup(),
      actor: setupBy,
      action: "create",
      entityType: "ResourceType",
      entityId: type.typeId,
      summary: `Created resource type "${type.name}"`,
    });
    for (const r of t.resources) {
      const resource = await tx.resource.create({
        data: { name: r.name, resourceType: type.typeId },
      });
      resourceIds.set(r.key, resource.resourceId);
      log({
        createdAt: nextSetup(),
        actor: setupBy,
        action: "create",
        entityType: "Resource",
        entityId: resource.resourceId,
        summary: `Created resource "${resource.name}"`,
      });
    }
  }

  // A task books its resources for the default window from its deadline,
  // the same as `defaultWindowFrom` in lib/resourceAllocations.ts.
  async function createTask(spec: TaskSpec, eventId: number | null, createdAt: Date) {
    const task = await tx.task.create({
      data: {
        name: spec.name,
        description: spec.description,
        deadline: spec.deadline,
        budget: spec.budget,
        event: eventId != null ? { connect: { eventId } } : undefined,
        bookable: {
          create: {
            bookableType: "Task",
            resourceAllocations: {
              create: (spec.resources ?? []).map((key) => ({
                resourceId: lookup(resourceIds, key),
                startTime: spec.deadline,
                endTime: plus(spec.deadline, DEFAULT_BOOKING_DURATION_MS),
              })),
            },
          },
        },
        taskManagers: {
          create: spec.managers.map((key) => ({ memberId: lookup(memberIds, key) })),
        },
      },
    });
    log({
      createdAt,
      actor: actor(spec.managers[0]),
      action: "create",
      entityType: "Task",
      entityId: task.taskId,
      summary: `Created task "${task.name}"`,
    });
    return task;
  }

  // Events — each created by its first manager a few weeks ahead, with its
  // tasks added over the following hours.
  for (const [i, spec] of EVENTS.entries()) {
    const totalBudget = spec.tasks.reduce((sum, t) => sum + (t.budget ?? 0), 0);
    const createdAt = new Date(
      Math.max(
        at(-68, 11).getTime(),
        Math.min(spec.start.getTime() - 24 * DAY, at(-3 - (i % 4), 10 + (i % 7)).getTime()),
      ),
    );
    const createdBy = actor(spec.managers[0]);

    const event = await tx.event.create({
      data: {
        name: spec.name,
        description: spec.description,
        date: spec.start,
        endDate: spec.end,
        totalBudget,
        location: { connect: { locationId: lookup(locationIds, spec.location) } },
        // An event holds its resources for exactly as long as it runs.
        bookable: {
          create: {
            bookableType: "Event",
            resourceAllocations: {
              create: spec.resources.map((key) => ({
                resourceId: lookup(resourceIds, key),
                startTime: spec.start,
                endTime: spec.end,
              })),
            },
          },
        },
        eventManagers: {
          create: spec.managers.map((key) => ({ memberId: lookup(memberIds, key) })),
        },
      },
    });
    log({
      createdAt,
      actor: createdBy,
      action: "create",
      entityType: "Event",
      entityId: event.eventId,
      summary: `Created event "${event.name}"`,
    });

    for (const [j, taskSpec] of spec.tasks.entries()) {
      const taskCreatedAt = plus(createdAt, (j + 1) * 50 * 60 * 1000);
      const task = await createTask(taskSpec, event.eventId, taskCreatedAt);
      if (j === 0 && taskSpec.deadline < NOW) {
        log({
          createdAt: plus(taskSpec.deadline, -DAY),
          actor: actor(taskSpec.managers[0]),
          action: "update",
          entityType: "Task",
          entityId: task.taskId,
          summary: `Updated task "${task.name}"`,
          changes: { fields: ["description"] },
        });
      }
    }

    if (spec.edited) {
      log({
        createdAt: plus(createdAt, 3 * DAY + 2 * HOUR),
        actor: createdBy,
        action: "update",
        entityType: "Event",
        entityId: event.eventId,
        summary: `Updated event "${event.name}"`,
        changes: { fields: spec.edited },
      });
    }

    // A booking added later through the Allocations page rather than the event form.
    if (spec.name === "Research Project Showcase") {
      const allocation = await tx.resourceAllocation.create({
        data: {
          bookableId: event.bookableId,
          resourceId: lookup(resourceIds, "tripod"),
          startTime: spec.start,
          endTime: spec.end,
        },
      });
      log({
        createdAt: plus(createdAt, 2 * DAY),
        actor: actor("mateo"),
        action: "create",
        entityType: "ResourceAllocation",
        entityId: allocation.allocationId,
        summary: `Allocated resource #${allocation.resourceId} to booking #${allocation.bookableId}`,
      });
    }

    // A task that was added and then dropped, so the log shows a delete.
    if (spec.name === "Industry Night") {
      const dropped = await createTask(
        {
          name: "Book event photographer",
          description: "",
          deadline: at(-24, 17),
          managers: ["aisha"],
        },
        event.eventId,
        plus(createdAt, 5 * HOUR),
      );
      // Same order as deleteTask in lib/tasks.ts.
      await tx.taskManager.deleteMany({ where: { taskId: dropped.taskId } });
      await tx.task.delete({ where: { taskId: dropped.taskId } });
      await tx.bookable.delete({ where: { bookableId: dropped.bookableId } });
      log({
        createdAt: plus(createdAt, 4 * DAY),
        actor: actor("aisha"),
        action: "delete",
        entityType: "Task",
        entityId: dropped.taskId,
        summary: `Deleted task "${dropped.name}"`,
      });
    }
  }

  for (const [i, spec] of STANDALONE_TASKS.entries()) {
    const createdAt = new Date(
      Math.min(spec.deadline.getTime() - 14 * DAY, at(-2 - i, 15).getTime()),
    );
    await createTask(spec, null, createdAt);
  }

  // Failed logins, and the guest — who only ever looks at the calendar.
  const chloe = actor("chloe");
  const olivia = actor("olivia");
  log({
    createdAt: at(-40, 9, 12),
    actor: null,
    action: "login_failed",
    entityType: "Member",
    entityId: 0,
    summary: "Failed login for unknown email admin@mdn.org",
  });
  log({
    createdAt: at(-12, 19, 3),
    actor: chloe,
    action: "login_failed",
    entityType: "Member",
    entityId: chloe.memberId,
    summary: `Failed login (wrong password) for ${chloe.email}`,
  });
  for (const day of [-18, -6, -1]) {
    log({
      createdAt: at(day, 12, 40),
      actor: olivia,
      action: "login",
      entityType: "Member",
      entityId: olivia.memberId,
      summary: `${olivia.email} logged in`,
    });
  }

  // Everyone who did something on a given day logged in first, and some
  // logged out afterwards.
  const sessions = new Map<string, { actor: Actor; first: Date; last: Date }>();
  for (const entry of audit) {
    if (!entry.actor || entry.action.startsWith("login")) continue;
    const key = `${entry.actor.memberId}:${entry.createdAt.toDateString()}`;
    const s = sessions.get(key);
    if (!s)
      sessions.set(key, { actor: entry.actor, first: entry.createdAt, last: entry.createdAt });
    else {
      if (entry.createdAt < s.first) s.first = entry.createdAt;
      if (entry.createdAt > s.last) s.last = entry.createdAt;
    }
  }
  for (const [i, s] of [...sessions.values()].entries()) {
    log({
      createdAt: plus(s.first, -7 * 60 * 1000),
      actor: s.actor,
      action: "login",
      entityType: "Member",
      entityId: s.actor.memberId,
      summary: `${s.actor.email} logged in`,
    });
    const logoutAt = plus(s.last, 20 * 60 * 1000);
    if (i % 2 === 0 && logoutAt < NOW) {
      log({
        createdAt: logoutAt,
        actor: s.actor,
        action: "logout",
        entityType: "Member",
        entityId: s.actor.memberId,
        summary: `${s.actor.email} logged out`,
      });
    }
  }

  audit.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  await tx.auditLog.createMany({
    data: audit.map((e) => ({
      createdAt: e.createdAt,
      actorId: e.actor?.memberId ?? null,
      actorName: e.actor?.name ?? "Unknown",
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      summary: e.summary,
      changes: e.changes,
    })),
  });

  return admin;
}

run(async (prisma) => {
  await confirmWipe();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // One transaction: if anything fails, the database is left as it was.
  await prisma.$transaction(
    async (tx) => {
      await wipeDatabase(tx);
      await populate(tx, passwordHash);
    },
    { timeout: 60_000 },
  );

  const [members, events, tasks, allocations, auditLogs] = await Promise.all([
    prisma.member.count(),
    prisma.event.count(),
    prisma.task.count(),
    prisma.resourceAllocation.count(),
    prisma.auditLog.count(),
  ]);
  console.log(
    `\n✅ Demo data loaded: ${members} members, ${events} events, ${tasks} tasks, ` +
      `${allocations} resource bookings, ${auditLogs} audit log entries.`,
  );
  console.log(`\nDemo logins (password "${DEMO_PASSWORD}" for all but the admin):`);
  for (const role of ["Manager", "Member", "Guest"] as const) {
    const m = MEMBERS.find((x) => x.role === role)!;
    const [first, last] = m.name.toLowerCase().split(" ");
    console.log(`   ${role.padEnd(8)} ${first}.${last}@mdn.com`);
  }
});
