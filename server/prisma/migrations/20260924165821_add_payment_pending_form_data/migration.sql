-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "eventId" INTEGER,
ADD COLUMN     "pendingFormData" JSONB,
ADD COLUMN     "phone" TEXT,
ALTER COLUMN "registrationId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "payments_eventId_idx" ON "payments"("eventId");

-- CreateIndex
CREATE INDEX "payments_phone_idx" ON "payments"("phone");
