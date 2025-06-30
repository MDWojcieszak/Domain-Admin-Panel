/*
  Warnings:

  - You are about to drop the column `uptime` on the `ServerProperties` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ServerProperties" DROP COLUMN "uptime",
ADD COLUMN     "isOnline" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "stoppedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serverStatusEmailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "serverIdleEmailNotifications" BOOLEAN NOT NULL DEFAULT false,
    "serverPushNotifications" BOOLEAN NOT NULL DEFAULT false,
    "processEmailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "processPushNotifications" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
