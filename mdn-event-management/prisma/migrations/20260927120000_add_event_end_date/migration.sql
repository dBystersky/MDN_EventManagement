-- Events stored a single timestamp, so "overlapping events" had no meaning.
-- Give every event a real range. Added nullable, backfilled, then made NOT NULL:
-- a bare `ADD COLUMN ... NOT NULL` would fail on any existing row.
ALTER TABLE "events" ADD COLUMN "end_date" TIMESTAMPTZ;

-- Two hours is the default span the forms offer for a single instant, so it is
-- also the honest backfill for rows that only ever had a start.
UPDATE "events" SET "end_date" = "date" + INTERVAL '2 hours';

ALTER TABLE "events" ALTER COLUMN "end_date" SET NOT NULL;

-- Both indexes serve the half-open overlap predicate clash detection runs:
--   start < other_end AND end > other_start
CREATE INDEX "events_event_location_id_date_end_date_idx"
  ON "events" ("event_location_id", "date", "end_date");

CREATE INDEX "resource_allocations_resource_id_start_time_end_time_idx"
  ON "resource_allocations" ("resource_id", "start_time", "end_time");
