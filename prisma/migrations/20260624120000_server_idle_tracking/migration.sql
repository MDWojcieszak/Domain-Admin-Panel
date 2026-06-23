-- AlterTable
ALTER TABLE "ServerProperties" ADD COLUMN     "idleNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "idleSince" TIMESTAMP(3);
