-- Repair migration: the `withdrawals` table is referenced by
-- 20260926000000_convert_to_uuid but no earlier migration creates it
-- (it was introduced out-of-band, e.g. via `prisma db push`).
-- This slots in BEFORE the convert migration (by timestamp order) so the
-- shadow database builds cleanly. All statements are IF NOT EXISTS-guarded,
-- so applying this to a database that already has `withdrawals` is a no-op
-- and no existing data is touched.
--
-- Shape matches the pre-convert (integer id-era) model: events.id was still
-- INT here, so withdrawals.eventId is INTEGER; convert_to_uuid later alters
-- it to TEXT along with the other event references.

-- CreateTable
CREATE TABLE IF NOT EXISTS "withdrawals" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "upiId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "transactionId" TEXT,
    "proofUrl" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizerId" TEXT NOT NULL,
    "eventId" INTEGER NOT NULL,

    CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "withdrawals_organizerId_idx" ON "withdrawals"("organizerId");
CREATE INDEX IF NOT EXISTS "withdrawals_eventId_idx" ON "withdrawals"("eventId");
CREATE INDEX IF NOT EXISTS "withdrawals_status_idx" ON "withdrawals"("status");

-- AddForeignKey (guarded so re-apply is safe)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'withdrawals_organizerId_fkey') THEN
    ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "organizers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'withdrawals_eventId_fkey') THEN
    ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
