/*
  Warnings:

  - You are about to drop the column `posterRectangleUrl` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `posterSquareUrl` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `paymentStatus` on the `registrations` table. All the data in the column will be lost.
  - You are about to drop the `payments` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_registrationId_fkey";

-- AlterTable
ALTER TABLE "events" DROP COLUMN "posterRectangleUrl",
DROP COLUMN "posterSquareUrl";

-- AlterTable
ALTER TABLE "registrations" DROP COLUMN "paymentStatus";

-- DropTable
DROP TABLE "payments";

-- DropEnum
DROP TYPE "PaymentStatus";
