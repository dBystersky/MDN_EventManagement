-- AlterTable
ALTER TABLE "members" ALTER COLUMN "role" SET DEFAULT 'Member';

-- CreateIndex
CREATE UNIQUE INDEX "members_email_key" ON "members"("email");
