/**
 * Shared by the database scripts in this folder:
 *
 *   seed.ts  — `npx prisma db seed`  — adds the admin, never deletes anything
 *   init.ts  — `npm run db:init`     — wipes everything, leaves only the admin
 *   demo.ts  — `npm run db:demo`     — wipes everything, then fills in demo data
 */

import bcrypt from "bcryptjs";
import { createInterface } from "node:readline/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../generated/prisma/client";
import "dotenv/config";

/** A client or a transaction — the helpers below work inside either. */
export type Db = Prisma.TransactionClient;

export function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env first.");
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@mdn.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";
const ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? "MDN Admin";

/**
 * Creates the master Admin account, or returns the existing one untouched.
 * Override the credentials with SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD /
 * SEED_ADMIN_NAME in `.env`. Do NOT commit real passwords here.
 */
export async function createAdmin(prisma: Db) {
  const existing = await prisma.member.findUnique({
    where: { email: ADMIN_EMAIL },
  });

  if (existing) {
    console.log(`ℹ️  Admin account already exists (${ADMIN_EMAIL}), skipping.`);
    return existing;
  }

  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.warn(
      '⚠️  SEED_ADMIN_PASSWORD not set in .env — using default "changeme123". Change it after seeding.',
    );
  }

  const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const admin = await prisma.member.create({
    data: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: hashed,
      role: "Admin",
    },
  });

  console.log(`✅ Admin account created:`);
  console.log(`   Email:    ${admin.email}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
  console.log(`   Role:     ${admin.role}`);

  return admin;
}

/** `host:port/database` from DATABASE_URL — never the password. */
function describeTarget() {
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    return `${url.host}${url.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

/**
 * Both destructive scripts call this first. Passes straight through with
 * `--yes`; otherwise asks, and exits unless the answer is exactly "yes".
 */
export async function confirmWipe() {
  const target = describeTarget();
  if (process.argv.includes("--yes")) {
    console.log(`🧹 Wiping all data in ${target} (--yes given).`);
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    `⚠️  This deletes ALL data in ${target}. Type "yes" to continue: `,
  );
  rl.close();

  if (answer.trim() !== "yes") {
    console.log("Aborted, nothing was changed.");
    process.exit(1);
  }
}

// Every app table. `_prisma_migrations` is deliberately absent so the schema
// survives — only rows go.
const APP_TABLES = [
  "audit_logs",
  "resource_allocations",
  "task_managers",
  "event_managers",
  "tasks",
  "events",
  "bookable",
  "resources",
  "resource_types",
  "locations",
  "members",
];

/** Empties every table and restarts every id sequence at 1. */
export async function wipeDatabase(prisma: Db) {
  const tables = APP_TABLES.map((t) => `"${t}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
}

/** Runs a script body with a client, disconnecting and exiting non-zero on failure. */
export function run(main: (prisma: PrismaClient) => Promise<void>) {
  const prisma = createClient();
  main(prisma)
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
