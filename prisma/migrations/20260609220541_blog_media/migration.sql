-- CreateEnum
CREATE TYPE "ImageScope" AS ENUM ('GALLERY', 'BLOG');

-- AlterTable
ALTER TABLE "Image" ADD COLUMN     "scope" "ImageScope" NOT NULL DEFAULT 'GALLERY',
ADD COLUMN     "uploadedById" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "BlogMediaAlbum" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverImageId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogMediaAlbum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogMediaAlbumItem" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlogMediaAlbumItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlogMediaAlbum_createdById_idx" ON "BlogMediaAlbum"("createdById");

-- CreateIndex
CREATE INDEX "BlogMediaAlbumItem_albumId_order_idx" ON "BlogMediaAlbumItem"("albumId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "BlogMediaAlbumItem_albumId_imageId_key" ON "BlogMediaAlbumItem"("albumId", "imageId");

-- CreateIndex
CREATE INDEX "Image_scope_idx" ON "Image"("scope");

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogMediaAlbum" ADD CONSTRAINT "BlogMediaAlbum_coverImageId_fkey" FOREIGN KEY ("coverImageId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogMediaAlbum" ADD CONSTRAINT "BlogMediaAlbum_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogMediaAlbumItem" ADD CONSTRAINT "BlogMediaAlbumItem_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "BlogMediaAlbum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogMediaAlbumItem" ADD CONSTRAINT "BlogMediaAlbumItem_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: any image referenced by blog/POI content becomes BLOG-scoped.
-- Everything else keeps the column default ('GALLERY') = personal gallery.
UPDATE "Image" SET "scope" = 'BLOG'
WHERE "id" IN (
  SELECT "imageId" FROM "BlogSectionImage"
  UNION SELECT "imageId" FROM "PoiImage"
  UNION SELECT "imageId" FROM "HomeBlock" WHERE "imageId" IS NOT NULL
  UNION SELECT "coverImageId" FROM "Poi" WHERE "coverImageId" IS NOT NULL
  UNION SELECT "coverImageId" FROM "BlogPostVersion" WHERE "coverImageId" IS NOT NULL
  UNION SELECT "ogImageId" FROM "BlogPostVersion" WHERE "ogImageId" IS NOT NULL
  UNION SELECT "coverImageId" FROM "BlogSeries" WHERE "coverImageId" IS NOT NULL
  UNION SELECT "coverImageId" FROM "PoiCollection" WHERE "coverImageId" IS NOT NULL
);

-- Backfill uploader from existing gallery metadata where available.
UPDATE "Image" i SET "uploadedById" = d."createdById"
FROM "ImageData" d
WHERE d."imageId" = i."id" AND i."uploadedById" IS NULL;
