/*
  Warnings:

  - The `lastError` column on the `ServerTransfer` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Made the column `secondsStart` on table `ServerTransfer` required. This step will fail if there are existing NULL values in that column.
  - Made the column `secondsStop` on table `ServerTransfer` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "ServerTransfer" ALTER COLUMN "secondsStart" SET NOT NULL,
ALTER COLUMN "secondsStop" SET NOT NULL,
DROP COLUMN "lastError",
ADD COLUMN     "lastError" TIMESTAMP(3);
