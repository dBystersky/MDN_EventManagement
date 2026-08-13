-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "member_role" AS ENUM ('Member', 'Manager', 'Admin');

-- CreateTable
CREATE TABLE "members" (
    "member_id" SERIAL NOT NULL,
    "name" VARCHAR NOT NULL,
    "role" "member_role" NOT NULL,
    "email" VARCHAR NOT NULL,
    "password" VARCHAR NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("member_id")
);

-- CreateTable
CREATE TABLE "event_managers" (
    "member_id" INTEGER NOT NULL,
    "event_id" INTEGER NOT NULL,

    CONSTRAINT "event_managers_pkey" PRIMARY KEY ("member_id","event_id")
);

-- CreateTable
CREATE TABLE "events" (
    "event_id" SERIAL NOT NULL,
    "name" VARCHAR NOT NULL,
    "description" VARCHAR,
    "date" TIMESTAMPTZ NOT NULL,
    "event_location_id" INTEGER NOT NULL,
    "bookable_id" INTEGER NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "task_managers" (
    "member_id" INTEGER NOT NULL,
    "task_id" INTEGER NOT NULL,

    CONSTRAINT "task_managers_pkey" PRIMARY KEY ("member_id","task_id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "task_id" SERIAL NOT NULL,
    "name" VARCHAR NOT NULL,
    "description" VARCHAR,
    "deadline" TIMESTAMPTZ NOT NULL,
    "bookable_id" INTEGER NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("task_id")
);

-- CreateTable
CREATE TABLE "resources" (
    "resource_id" SERIAL NOT NULL,
    "name" VARCHAR NOT NULL,
    "resource_type" INTEGER NOT NULL,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("resource_id")
);

-- CreateTable
CREATE TABLE "resource_allocations" (
    "allocation_id" SERIAL NOT NULL,
    "start_time" TIMESTAMPTZ NOT NULL,
    "end_time" TIMESTAMPTZ NOT NULL,
    "bookable_id" INTEGER NOT NULL,
    "resource_id" INTEGER NOT NULL,

    CONSTRAINT "resource_allocations_pkey" PRIMARY KEY ("allocation_id")
);

-- CreateTable
CREATE TABLE "bookable" (
    "bookable_id" SERIAL NOT NULL,
    "bookable_type" VARCHAR NOT NULL,

    CONSTRAINT "bookable_pkey" PRIMARY KEY ("bookable_id")
);

-- CreateTable
CREATE TABLE "locations" (
    "location_id" SERIAL NOT NULL,
    "name" VARCHAR NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("location_id")
);

-- CreateTable
CREATE TABLE "resource_types" (
    "type_id" SERIAL NOT NULL,
    "name" VARCHAR NOT NULL,

    CONSTRAINT "resource_types_pkey" PRIMARY KEY ("type_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "events_bookable_id_key" ON "events"("bookable_id");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_bookable_id_key" ON "tasks"("bookable_id");

-- AddForeignKey
ALTER TABLE "event_managers" ADD CONSTRAINT "event_managers_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("member_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_managers" ADD CONSTRAINT "event_managers_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("event_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_event_location_id_fkey" FOREIGN KEY ("event_location_id") REFERENCES "locations"("location_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_bookable_id_fkey" FOREIGN KEY ("bookable_id") REFERENCES "bookable"("bookable_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_managers" ADD CONSTRAINT "task_managers_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("member_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_managers" ADD CONSTRAINT "task_managers_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("task_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_bookable_id_fkey" FOREIGN KEY ("bookable_id") REFERENCES "bookable"("bookable_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_resource_type_fkey" FOREIGN KEY ("resource_type") REFERENCES "resource_types"("type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_allocations" ADD CONSTRAINT "resource_allocations_bookable_id_fkey" FOREIGN KEY ("bookable_id") REFERENCES "bookable"("bookable_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_allocations" ADD CONSTRAINT "resource_allocations_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("resource_id") ON DELETE RESTRICT ON UPDATE CASCADE;
