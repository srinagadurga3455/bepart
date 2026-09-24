-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('ADMIN_LOGIN', 'ORGANIZER_LOGIN');

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;

-- CreateTable
CREATE TABLE "otp_verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "otp_verifications_identifier_idx" ON "otp_verifications"("identifier");

-- CreateIndex
CREATE INDEX "otp_verifications_expiresAt_idx" ON "otp_verifications"("expiresAt");
