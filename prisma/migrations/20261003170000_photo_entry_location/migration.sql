-- Location of a photo entry (docs/photo-entry-planning-and-publish.md §3).

-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "timezone" TEXT;

-- AlterTable
ALTER TABLE "PhotoEntry" ADD COLUMN     "locationId" TEXT;

-- AddForeignKey
ALTER TABLE "PhotoEntry" ADD CONSTRAINT "PhotoEntry_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

