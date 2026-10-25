-- CreateEnum
CREATE TYPE "BomStatus" AS ENUM ('NEEDED', 'ORDERED', 'HAVE', 'USED');

-- AlterTable
ALTER TABLE "DocumentLink" ADD COLUMN     "bomItemId" TEXT,
ADD COLUMN     "journalEntryId" TEXT;

-- CreateTable
CREATE TABLE "BomItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "unit" TEXT,
    "status" "BomStatus" NOT NULL DEFAULT 'NEEDED',
    "unitPrice" DECIMAL(12,2),
    "currency" TEXT,
    "supplier" TEXT,
    "url" TEXT,
    "note" TEXT,
    "gearItemId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BomItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "happenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "projectId" TEXT,
    "taskId" TEXT,
    "bomItemId" TEXT,
    "journalEntryId" TEXT,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BomItem_projectId_order_idx" ON "BomItem"("projectId", "order");

-- CreateIndex
CREATE INDEX "JournalEntry_projectId_happenedAt_idx" ON "JournalEntry"("projectId", "happenedAt");

-- CreateIndex
CREATE INDEX "Comment_projectId_createdAt_idx" ON "Comment"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_taskId_createdAt_idx" ON "Comment"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_bomItemId_createdAt_idx" ON "Comment"("bomItemId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_journalEntryId_createdAt_idx" ON "Comment"("journalEntryId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentLink_bomItemId_idx" ON "DocumentLink"("bomItemId");

-- CreateIndex
CREATE INDEX "DocumentLink_journalEntryId_idx" ON "DocumentLink"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentLink_documentId_bomItemId_key" ON "DocumentLink"("documentId", "bomItemId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentLink_documentId_journalEntryId_key" ON "DocumentLink"("documentId", "journalEntryId");

-- AddForeignKey
ALTER TABLE "DocumentLink" ADD CONSTRAINT "DocumentLink_bomItemId_fkey" FOREIGN KEY ("bomItemId") REFERENCES "BomItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentLink" ADD CONSTRAINT "DocumentLink_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomItem" ADD CONSTRAINT "BomItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomItem" ADD CONSTRAINT "BomItem_gearItemId_fkey" FOREIGN KEY ("gearItemId") REFERENCES "GearItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_bomItemId_fkey" FOREIGN KEY ("bomItemId") REFERENCES "BomItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A pin still has exactly one target, now among four (I6).
ALTER TABLE "DocumentLink" DROP CONSTRAINT "DocumentLink_one_target";
ALTER TABLE "DocumentLink" ADD CONSTRAINT "DocumentLink_one_target" CHECK (num_nonnulls("projectId", "taskId", "bomItemId", "journalEntryId") = 1);

-- So does a comment (I6).
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_one_target" CHECK (num_nonnulls("projectId", "taskId", "bomItemId", "journalEntryId") = 1);
