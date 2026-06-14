-- AlterTable
ALTER TABLE "PoiCollection" DROP COLUMN "country",
ADD COLUMN     "countryId" TEXT;

-- AddForeignKey
ALTER TABLE "PoiCollection" ADD CONSTRAINT "PoiCollection_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "BlogCountry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
