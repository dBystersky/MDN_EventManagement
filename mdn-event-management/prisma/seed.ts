/**
 * Prisma seed script — creates the master Admin account.
 *
 * Run with:  npx prisma db seed
 *
 * Safe to re-run: it never deletes anything, and skips the admin if one with
 * the same email already exists. For a clean database use `npm run db:init`;
 * for demo data use `npm run db:demo`.
 */

import { createAdmin, run } from "./seed-utils";

run(async (prisma) => {
  await createAdmin(prisma);
  console.log(`\n⚠️  Change this password after first login!`);
});
