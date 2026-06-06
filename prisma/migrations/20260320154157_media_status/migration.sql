/*
  Warnings:

  - The values [IMPORTED] on the enum `PhotoEntryStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('UPLOADED', 'NOT_UPLOADED');

-- AlterEnum
BEGIN;
CREATE TYPE "PhotoEntryStatus_new" AS ENUM ('PLANNED', 'ACTIVE', 'SELECTED', 'EDITING', 'COMPLETED');
ALTER TABLE "public"."PhotoEntry" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "PhotoEntry" ALTER COLUMN "status" TYPE "PhotoEntryStatus_new" USING ("status"::text::"PhotoEntryStatus_new");
ALTER TYPE "PhotoEntryStatus" RENAME TO "PhotoEntryStatus_old";
ALTER TYPE "PhotoEntryStatus_new" RENAME TO "PhotoEntryStatus";
DROP TYPE "public"."PhotoEntryStatus_old";
ALTER TABLE "PhotoEntry" ALTER COLUMN "status" SET DEFAULT 'PLANNED';
COMMIT;

-- AlterTable
ALTER TABLE "PhotoEntry" ADD COLUMN     "uploadStatus" "MediaStatus" NOT NULL DEFAULT 'NOT_UPLOADED';
