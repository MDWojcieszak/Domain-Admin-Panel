-- CreateEnum
CREATE TYPE "CommandMatchType" AS ENUM ('CONTAINS', 'STARTS_WITH', 'REGEX');

-- CreateEnum
CREATE TYPE "CommandRuntimeStatus" AS ENUM ('IDLE', 'STARTING', 'RUNNING', 'STOPPING', 'STOPPED', 'ERROR');

-- AlterTable
ALTER TABLE "ServerCommand" ADD COLUMN     "runtimeStatus" "CommandRuntimeStatus" NOT NULL DEFAULT 'IDLE';

-- AlterTable
ALTER TABLE "Process" ADD COLUMN     "commandId" TEXT,
ADD COLUMN     "progress" INTEGER DEFAULT 0;

-- CreateTable
CREATE TABLE "CommandProgressMarker" (
    "id" TEXT NOT NULL,
    "commandId" TEXT NOT NULL,
    "label" TEXT,
    "pattern" TEXT NOT NULL,
    "matchType" "CommandMatchType" NOT NULL DEFAULT 'CONTAINS',
    "progress" INTEGER,
    "runtimeStatus" "CommandRuntimeStatus",
    "level" "ProcessLogLevel",
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommandProgressMarker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommandProgressMarker_commandId_idx" ON "CommandProgressMarker"("commandId");

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_commandId_fkey" FOREIGN KEY ("commandId") REFERENCES "ServerCommand"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandProgressMarker" ADD CONSTRAINT "CommandProgressMarker_commandId_fkey" FOREIGN KEY ("commandId") REFERENCES "ServerCommand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
