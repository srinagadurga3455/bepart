-- Optional official WhatsApp group link per event (announcements/updates).
-- Additive only: one nullable column, no default. All existing events keep
-- whatsappGroupLink = NULL and work unchanged. No data is modified.

ALTER TABLE "events" ADD COLUMN "whatsappGroupLink" TEXT;
