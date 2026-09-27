-- Add Razorpay order/payment references to payments.
-- Nullable so all existing payments remain valid.
ALTER TABLE "payments" ADD COLUMN "razorpayOrderId" TEXT;
ALTER TABLE "payments" ADD COLUMN "razorpayPaymentId" TEXT;

CREATE INDEX IF NOT EXISTS "payments_razorpayOrderId_idx" ON "payments"("razorpayOrderId");
