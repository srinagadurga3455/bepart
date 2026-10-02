-- WhatsApp ticket-confirmation delivery audit (Meta WhatsApp Cloud API).
-- Additive only: creates one new table + enum. No existing table is altered,
-- no data is modified. One row per ticket (ticketId unique) so webhook
-- replays and retries can never double-send a confirmation.

-- CreateEnum
CREATE TYPE "WhatsappDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "whatsapp_deliveries" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" "WhatsappDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "providerMessageId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_deliveries_ticketId_key" ON "whatsapp_deliveries"("ticketId");

-- CreateIndex
CREATE INDEX "whatsapp_deliveries_status_idx" ON "whatsapp_deliveries"("status");

-- AddForeignKey
ALTER TABLE "whatsapp_deliveries" ADD CONSTRAINT "whatsapp_deliveries_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
