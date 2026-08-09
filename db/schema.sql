-- Event Management System schema

CREATE TYPE "member_role" AS ENUM (
  'Member',
  'Manager',
  'Admin'
);

CREATE TABLE "members" (
  "member_id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "name" varchar NOT NULL,
  "role" member_role NOT NULL,
  "email" varchar NOT NULL,
  "password" varchar NOT NULL
);

CREATE TABLE "event_managers" (
  "member_id" integer NOT NULL,
  "event_id" integer NOT NULL,
  PRIMARY KEY ("member_id", "event_id")
);

CREATE TABLE "events" (
  "event_id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "name" varchar NOT NULL,
  "description" varchar,
  "date" timestamptz NOT NULL,
  "event_location_id" integer NOT NULL,
  "bookable_id" integer UNIQUE NOT NULL
);

CREATE TABLE "task_managers" (
  "member_id" integer NOT NULL,
  "task_id" integer NOT NULL,
  PRIMARY KEY ("member_id", "task_id")
);

CREATE TABLE "tasks" (
  "task_id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "name" varchar NOT NULL,
  "description" varchar,
  "deadline" timestamptz NOT NULL,
  "bookable_id" integer UNIQUE NOT NULL
);

CREATE TABLE "resources" (
  "resource_id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "name" varchar NOT NULL,
  "resource_type" integer NOT NULL
);

CREATE TABLE "resource_allocations" (
  "allocation_id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "start_time" timestamptz NOT NULL,
  "end_time" timestamptz NOT NULL,
  "bookable_id" integer NOT NULL,
  "resource_id" integer NOT NULL
);

CREATE TABLE "bookable" (
  "bookable_id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "bookable_type" varchar NOT NULL
);

CREATE TABLE "locations" (
  "location_id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "name" varchar NOT NULL
);

CREATE TABLE "resource_types" (
  "type_id" integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "name" varchar NOT NULL
);

ALTER TABLE "event_managers" ADD FOREIGN KEY ("member_id") REFERENCES "members" ("member_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "event_managers" ADD FOREIGN KEY ("event_id") REFERENCES "events" ("event_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "events" ADD FOREIGN KEY ("event_location_id") REFERENCES "locations" ("location_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "events" ADD FOREIGN KEY ("bookable_id") REFERENCES "bookable" ("bookable_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "task_managers" ADD FOREIGN KEY ("member_id") REFERENCES "members" ("member_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "task_managers" ADD FOREIGN KEY ("task_id") REFERENCES "tasks" ("task_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "tasks" ADD FOREIGN KEY ("bookable_id") REFERENCES "bookable" ("bookable_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "resources" ADD FOREIGN KEY ("resource_type") REFERENCES "resource_types" ("type_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "resource_allocations" ADD FOREIGN KEY ("bookable_id") REFERENCES "bookable" ("bookable_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "resource_allocations" ADD FOREIGN KEY ("resource_id") REFERENCES "resources" ("resource_id") DEFERRABLE INITIALLY IMMEDIATE;
