-- Organizer/event visibility switch for the admin deactivation cascade.
-- Deactivating an organizer sets organizers.isActive=false and cascades to
-- events.isActive=false; reactivation restores both. Public listing and
-- registration only include active events. Defaults keep existing rows visible.
ALTER TABLE "organizers" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "events" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "organizers_isActive_idx" ON "organizers"("isActive");
CREATE INDEX "events_isActive_idx" ON "events"("isActive");

-- QR check-in timestamp on registrations. Set when an organizer/admin scans
-- the participant ticket at entry; NULL means not checked in yet.
ALTER TABLE "registrations" ADD COLUMN "checkedInAt" TIMESTAMP(3);
