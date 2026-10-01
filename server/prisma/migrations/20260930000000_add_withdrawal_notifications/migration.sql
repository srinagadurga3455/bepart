-- Withdrawal/payout WhatsApp notification audit.
-- Additive only: creates two enums + one new table. No existing table is
-- altered, no data is modified. One row per send attempt; a FAILED row never
-- affects the withdrawal itself (notifications are side effects).

-- CreateEnum
CREATE TYPE "WithdrawalNotificationKind" AS ENUM ('PAYOUT_REQUEST', 'PAYOUT_SUCCESS', 'PAYOUT_REJECTED');

-- CreateEnum
CREATE TYPE "WithdrawalNotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "withdrawal_notifications" (
    "id" TEXT NOT NULL,
    "withdrawalId" TEXT NOT NULL,
    "kind" "WithdrawalNotificationKind" NOT NULL,
    "to" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "status" "WithdrawalNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "providerMessageId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "withdrawal_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "withdrawal_notifications_withdrawalId_idx" ON "withdrawal_notifications"("withdrawalId");

-- CreateIndex
CREATE INDEX "withdrawal_notifications_status_idx" ON "withdrawal_notifications"("status");

-- AddForeignKey
ALTER TABLE "withdrawal_notifications" ADD CONSTRAINT "withdrawal_notifications_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "withdrawals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
