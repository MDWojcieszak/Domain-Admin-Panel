-- AlterTable
ALTER TABLE "BomItem" ADD COLUMN     "photoId" TEXT;

-- AddForeignKey
ALTER TABLE "BomItem" ADD CONSTRAINT "BomItem_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

