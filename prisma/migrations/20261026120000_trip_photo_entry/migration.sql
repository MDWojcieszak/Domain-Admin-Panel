-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "photoEntryId" TEXT;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_photoEntryId_fkey" FOREIGN KEY ("photoEntryId") REFERENCES "PhotoEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

