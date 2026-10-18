-- Roles become Executive / Manager / Member: Admin is renamed, Guest is dropped.
UPDATE "members" SET "role" = 'Member' WHERE "role" = 'Guest';
ALTER TYPE "member_role" RENAME VALUE 'Admin' TO 'Executive';
ALTER TYPE "member_role" RENAME TO "member_role_old";
CREATE TYPE "member_role" AS ENUM ('Member', 'Manager', 'Executive');
ALTER TABLE "members" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "members" ALTER COLUMN "role" TYPE "member_role" USING ("role"::text::"member_role");
ALTER TABLE "members" ALTER COLUMN "role" SET DEFAULT 'Member';
DROP TYPE "member_role_old";

-- CreateEnum
CREATE TYPE "task_status" AS ENUM ('backlog', 'ready_to_do', 'in_progress', 'blocked', 'done');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "status" "task_status" NOT NULL DEFAULT 'backlog';

-- CreateTable
CREATE TABLE "event_members" (
    "member_id" INTEGER NOT NULL,
    "event_id" INTEGER NOT NULL,

    CONSTRAINT "event_members_pkey" PRIMARY KEY ("member_id","event_id")
);

-- AddForeignKey
ALTER TABLE "event_members" ADD CONSTRAINT "event_members_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("member_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_members" ADD CONSTRAINT "event_members_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("event_id") ON DELETE RESTRICT ON UPDATE CASCADE;
