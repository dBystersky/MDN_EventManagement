/**
 * Prisma seed script — creates the master Admin account.
 *
 * Run with:  npx prisma db seed
 *
 * Change ADMIN_EMAIL / ADMIN_PASSWORD below before running if you want
 * different credentials. Do NOT commit real passwords here.
 */

import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env first.');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const ADMIN_EMAIL    = process.env.SEED_ADMIN_EMAIL    ?? 'admin@mdn.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'changeme123';
const ADMIN_NAME     = process.env.SEED_ADMIN_NAME     ?? 'MDN Admin';

if (!process.env.SEED_ADMIN_PASSWORD) {
  console.warn('⚠️  SEED_ADMIN_PASSWORD not set in .env — using default "changeme123". Change it after seeding.');
}

async function main() {
  const existing = await prisma.member.findUnique({
    where: { email: ADMIN_EMAIL },
  });

  if (existing) {
    console.log(`ℹ️  Admin account already exists (${ADMIN_EMAIL}), skipping.`);
    return;
  }

  const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const admin = await prisma.member.create({
    data: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: hashed,
      role: 'Admin',
    },
  });

  console.log(`✅ Admin account created:`);
  console.log(`   Email:    ${admin.email}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
  console.log(`   Role:     ${admin.role}`);
  console.log(`\n⚠️  Change this password after first login!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
