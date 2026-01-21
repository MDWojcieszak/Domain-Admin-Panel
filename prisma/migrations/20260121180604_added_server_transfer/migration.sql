/*
  Warnings:

  - A unique constraint covering the columns `[serverId,value]` on the table `ServerCategory` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ServerTransferMode" AS ENUM ('MOVE', 'COPY');

-- CreateEnum
CREATE TYPE "ServerTransferStatus" AS ENUM ('IDLE', 'RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "CategorySource" AS ENUM ('AGENT', 'MAIN');

-- AlterTable
ALTER TABLE "ServerCategory" ADD COLUMN     "source" "CategorySource" NOT NULL DEFAULT 'AGENT';

-- CreateTable
CREATE TABLE "ServerTransfer" (
    "id" TEXT NOT NULL,
    "serverCategoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "originPath" TEXT NOT NULL,
    "targetPath" TEXT NOT NULL,
    "agentLogPath" TEXT,
    "enableMoveBackup" BOOLEAN NOT NULL DEFAULT false,
    "moveBackupPath" TEXT,
    "mode" "ServerTransferMode" NOT NULL DEFAULT 'COPY',
    "status" "ServerTransferStatus" NOT NULL DEFAULT 'IDLE',
    "bwLimitKbps" INTEGER,
    "secondsStart" INTEGER,
    "secondsStop" INTEGER,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "queuedFiles" BIGINT NOT NULL DEFAULT 0,
    "queuedBytes" BIGINT NOT NULL DEFAULT 0,
    "sentFiles" BIGINT NOT NULL DEFAULT 0,
    "sentBytes" BIGINT NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "currentProcessId" TEXT,

    CONSTRAINT "ServerTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServerTransfer_serverCategoryId_idx" ON "ServerTransfer"("serverCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ServerTransfer_serverCategoryId_name_key" ON "ServerTransfer"("serverCategoryId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ServerCategory_serverId_value_key" ON "ServerCategory"("serverId", "value");

-- AddForeignKey
ALTER TABLE "ServerTransfer" ADD CONSTRAINT "ServerTransfer_serverCategoryId_fkey" FOREIGN KEY ("serverCategoryId") REFERENCES "ServerCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerTransfer" ADD CONSTRAINT "ServerTransfer_currentProcessId_fkey" FOREIGN KEY ("currentProcessId") REFERENCES "Process"("id") ON DELETE SET NULL ON UPDATE CASCADE;
