-- Enable pgcrypto for gen_random_uuid
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop foreign keys that reference events(id)
ALTER TABLE "registrations" DROP CONSTRAINT IF EXISTS "registrations_eventId_fkey";
ALTER TABLE "withdrawals" DROP CONSTRAINT IF EXISTS "withdrawals_eventId_fkey";
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_eventId_fkey";

-- For Event: change id from INT to TEXT (UUID)
-- Existing integer ids will become text "1", "2" etc., new records will use gen_random_uuid()
ALTER TABLE "events" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "events" ALTER COLUMN "id" SET DATA TYPE TEXT USING "id"::text;
ALTER TABLE "events" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- For Registration: change eventId from INT to TEXT
ALTER TABLE "registrations" ALTER COLUMN "eventId" SET DATA TYPE TEXT USING "eventId"::text;

-- For Withdrawals: change eventId from INT to TEXT
ALTER TABLE "withdrawals" ALTER COLUMN "eventId" SET DATA TYPE TEXT USING "eventId"::text;

-- For Payments: change eventId from INT to TEXT (nullable)
ALTER TABLE "payments" ALTER COLUMN "eventId" SET DATA TYPE TEXT USING "eventId"::text;

-- Recreate foreign keys with new type
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Update defaults for String ids that were cuid() to uuid()
ALTER TABLE "users" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "otp_verifications" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "admins" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "organizers" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "registrations" ALTER COLUMN "registrationId" SET DEFAULT gen_random_uuid();
ALTER TABLE "withdrawals" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "payments" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

