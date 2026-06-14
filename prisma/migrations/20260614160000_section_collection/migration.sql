-- AlterEnum
ALTER TYPE "BlogSectionType" ADD VALUE 'COLLECTION';

-- AlterTable
ALTER TABLE "BlogSection" ADD COLUMN     "collectionId" TEXT;

-- AddForeignKey
ALTER TABLE "BlogSection" ADD CONSTRAINT "BlogSection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "PoiCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
