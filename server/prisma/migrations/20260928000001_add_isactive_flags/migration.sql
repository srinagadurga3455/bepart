-- Backend code (public event listing, organizer deactivate/reactivate,
-- registration guards) already reads/writes Event.isActive and
-- Organizer.isActive, but the columns were never migrated, so the public
-- event list failed with "Unknown argument `isActive`". Additive with
-- DEFAULT true so current visibility is preserved. Guarded so re-apply is safe.
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "organizers" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS "events_isActive_idx" ON "events"("isActive");
