/**
 * Resets the database to a clean slate: every table emptied, ids restarted,
 * and only the master Admin account recreated.
 *
 * Run with:  npm run db:init           (asks before wiping)
 *            npm run db:init -- --yes  (no prompt)
 *
 * `npm run db:init` applies pending migrations first, so this also works on a
 * brand-new, empty Postgres.
 */

import { confirmWipe, createAdmin, run, wipeDatabase } from "./seed-utils";

run(async (prisma) => {
  await confirmWipe();
  await wipeDatabase(prisma);
  await createAdmin(prisma);
  console.log(`\n✅ Database initialised — the admin above is the only account.`);
});
