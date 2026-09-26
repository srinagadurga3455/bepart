-- Withdrawal amounts move from Float rupees to Int paise, consistent with
-- Payment.amount (Int paise: 50000 = Rs.500.00). Existing rupee values are
-- scaled x100 and rounded so their monetary value is preserved
-- (e.g. 23800.0 rupees -> 2380000 paise).
ALTER TABLE "withdrawals" ALTER COLUMN "amount" SET DATA TYPE INTEGER USING (round("amount" * 100)::INTEGER);

-- Reason recorded when an admin rejects a withdrawal. NULL otherwise.
ALTER TABLE "withdrawals" ADD COLUMN "rejectionReason" TEXT;
