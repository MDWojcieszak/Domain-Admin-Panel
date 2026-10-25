-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "bomItemId" TEXT;

-- CreateIndex
CREATE INDEX "Task_bomItemId_idx" ON "Task"("bomItemId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_bomItemId_fkey" FOREIGN KEY ("bomItemId") REFERENCES "BomItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

