-- AlterTable: coupon lifecycle fields (additive; existing rows get safe defaults)
ALTER TABLE "coupons" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "coupons" ADD COLUMN "startsAt" TIMESTAMP(3);
ALTER TABLE "coupons" ADD COLUMN "usedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "coupons" ADD COLUMN "usageLimit" INTEGER;

-- CreateIndex
CREATE INDEX "coupons_isActive_idx" ON "coupons"("isActive");

-- AlterTable: payment pricing audit (additive)
ALTER TABLE "payments" ADD COLUMN "couponCode" TEXT;
ALTER TABLE "payments" ADD COLUMN "originalAmount" INTEGER;
ALTER TABLE "payments" ADD COLUMN "discountAmount" INTEGER DEFAULT 0;

-- Backfill: pre-feature payments were full-price (no discount info stored)
UPDATE "payments" SET "originalAmount" = "amount" WHERE "originalAmount" IS NULL;
UPDATE "payments" SET "discountAmount" = 0 WHERE "discountAmount" IS NULL;

-- AlterTable: registration pricing snapshot (all nullable; pre-feature rows stay valid)
ALTER TABLE "registrations" ADD COLUMN "couponId" TEXT;
ALTER TABLE "registrations" ADD COLUMN "couponCode" TEXT;
ALTER TABLE "registrations" ADD COLUMN "originalAmount" INTEGER;
ALTER TABLE "registrations" ADD COLUMN "discountAmount" INTEGER DEFAULT 0;
ALTER TABLE "registrations" ADD COLUMN "totalAmount" INTEGER;

-- CreateIndex
CREATE INDEX "registrations_couponId_idx" ON "registrations"("couponId");

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
