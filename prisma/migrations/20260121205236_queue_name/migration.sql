/*
  Warnings:

  - A unique constraint covering the columns `[queueName]` on the table `Server` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `queueName` to the `Server` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Server" ADD COLUMN     "queueName" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Server_queueName_key" ON "Server"("queueName");
