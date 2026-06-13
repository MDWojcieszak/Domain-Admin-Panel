-- Drop template tables FIRST: their `type` column uses BlogSectionType (recreated
-- below) and their media* columns use the media enums (dropped below).
-- DropForeignKey
ALTER TABLE "BlogSectionTemplateBlock" DROP CONSTRAINT "BlogSectionTemplateBlock_templateId_fkey";

-- DropTable
DROP TABLE "BlogSectionTemplateBlock";

-- DropTable
DROP TABLE "BlogSectionTemplate";

-- AlterEnum (drop MEDIA_TEXT, add COLUMNS/COLUMN)
BEGIN;
CREATE TYPE "BlogSectionType_new" AS ENUM ('HEADING', 'PARAGRAPH', 'QUOTE', 'CALLOUT', 'LIST', 'IMAGE', 'GALLERY', 'MAP', 'PLACE', 'EMBED', 'DIVIDER', 'COLUMNS', 'COLUMN');
ALTER TABLE "BlogSection" ALTER COLUMN "type" TYPE "BlogSectionType_new" USING ("type"::text::"BlogSectionType_new");
ALTER TYPE "BlogSectionType" RENAME TO "BlogSectionType_old";
ALTER TYPE "BlogSectionType_new" RENAME TO "BlogSectionType";
DROP TYPE "public"."BlogSectionType_old";
COMMIT;

-- AlterTable
ALTER TABLE "BlogSection" DROP COLUMN "mediaPosition",
DROP COLUMN "mediaSplit",
DROP COLUMN "mobileStackOrder",
ADD COLUMN     "columnWidth" DOUBLE PRECISION,
ADD COLUMN     "parentId" TEXT;

-- DropEnum (no longer referenced after the columns/tables above are gone)
DROP TYPE "BlogMediaPosition";

-- DropEnum
DROP TYPE "BlogMediaSplit";

-- DropEnum
DROP TYPE "BlogMobileStackOrder";

-- CreateIndex
CREATE INDEX "BlogSection_parentId_order_idx" ON "BlogSection"("parentId", "order");

-- AddForeignKey
ALTER TABLE "BlogSection" ADD CONSTRAINT "BlogSection_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "BlogSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
