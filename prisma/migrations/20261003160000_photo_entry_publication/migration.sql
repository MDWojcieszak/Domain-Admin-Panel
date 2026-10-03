-- Publishing from an entry's export folder (docs/photo-entry-planning-and-publish.md §2).
-- Registry of which export file became which gallery image.

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "PhotoEntryPublication" (
    "id" TEXT NOT NULL,
    "photoEntryId" TEXT NOT NULL,
    "relativePath" TEXT NOT NULL,
    "sourceSize" BIGINT,
    "sourceMtime" TIMESTAMP(3),
    "imageId" TEXT,
    "galleryId" TEXT,
    "status" "PublicationStatus" NOT NULL,
    "error" TEXT,
    "publishedAt" TIMESTAMP(3),
    "requestedById" TEXT NOT NULL,
    "queuePosition" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhotoEntryPublication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhotoEntryPublication_status_idx" ON "PhotoEntryPublication"("status");

-- CreateIndex
CREATE INDEX "PhotoEntryPublication_imageId_idx" ON "PhotoEntryPublication"("imageId");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoEntryPublication_photoEntryId_relativePath_key" ON "PhotoEntryPublication"("photoEntryId", "relativePath");

-- AddForeignKey
ALTER TABLE "PhotoEntryPublication" ADD CONSTRAINT "PhotoEntryPublication_photoEntryId_fkey" FOREIGN KEY ("photoEntryId") REFERENCES "PhotoEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoEntryPublication" ADD CONSTRAINT "PhotoEntryPublication_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoEntryPublication" ADD CONSTRAINT "PhotoEntryPublication_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

