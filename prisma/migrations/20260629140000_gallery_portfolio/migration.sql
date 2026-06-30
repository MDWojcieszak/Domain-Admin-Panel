-- Gallery / portfolio feature (squashed): image processing state, derived
-- dimensions + orientation, EXIF, and the gallery CMS. Idempotent — safe on
-- fresh & existing DBs.

-- ---------- Enums ----------
DO $$ BEGIN
  CREATE TYPE "ImageProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ImageOrientation" AS ENUM ('LANDSCAPE', 'PORTRAIT', 'SQUARE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "GalleryStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "GalleryImageRole" AS ENUM ('HERO', 'LARGE', 'NORMAL', 'HIDDEN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------- Image: processing state + derived data + EXIF ----------
ALTER TABLE "Image" ADD COLUMN IF NOT EXISTS "processingStatus" "ImageProcessingStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Image" ADD COLUMN IF NOT EXISTS "processingError" TEXT;
ALTER TABLE "Image" ADD COLUMN IF NOT EXISTS "processedAt" TIMESTAMP(3);
ALTER TABLE "Image" ADD COLUMN IF NOT EXISTS "width" INTEGER;
ALTER TABLE "Image" ADD COLUMN IF NOT EXISTS "height" INTEGER;
ALTER TABLE "Image" ADD COLUMN IF NOT EXISTS "orientation" "ImageOrientation";
ALTER TABLE "Image" ADD COLUMN IF NOT EXISTS "cameraMake" TEXT;
ALTER TABLE "Image" ADD COLUMN IF NOT EXISTS "cameraModel" TEXT;
ALTER TABLE "Image" ADD COLUMN IF NOT EXISTS "lens" TEXT;
ALTER TABLE "Image" ADD COLUMN IF NOT EXISTS "focalLength" DOUBLE PRECISION;
ALTER TABLE "Image" ADD COLUMN IF NOT EXISTS "fNumber" DOUBLE PRECISION;
ALTER TABLE "Image" ADD COLUMN IF NOT EXISTS "iso" INTEGER;
ALTER TABLE "Image" ADD COLUMN IF NOT EXISTS "exposureTime" TEXT;
ALTER TABLE "Image" ADD COLUMN IF NOT EXISTS "takenAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Image_processingStatus_idx" ON "Image"("processingStatus");

-- ---------- Gallery CMS ----------
CREATE TABLE IF NOT EXISTS "Gallery" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "GalleryStatus" NOT NULL DEFAULT 'DRAFT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "coverImageId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Gallery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GalleryImage" (
    "id" TEXT NOT NULL,
    "galleryId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "role" "GalleryImageRole" NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GalleryImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Gallery_slug_key" ON "Gallery"("slug");
CREATE INDEX IF NOT EXISTS "Gallery_status_sortOrder_idx" ON "Gallery"("status", "sortOrder");
CREATE INDEX IF NOT EXISTS "Gallery_createdById_idx" ON "Gallery"("createdById");
CREATE UNIQUE INDEX IF NOT EXISTS "GalleryImage_galleryId_imageId_key" ON "GalleryImage"("galleryId", "imageId");
CREATE INDEX IF NOT EXISTS "GalleryImage_galleryId_order_idx" ON "GalleryImage"("galleryId", "order");

DO $$ BEGIN
  ALTER TABLE "Gallery" ADD CONSTRAINT "Gallery_coverImageId_fkey" FOREIGN KEY ("coverImageId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Gallery" ADD CONSTRAINT "Gallery_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "GalleryImage" ADD CONSTRAINT "GalleryImage_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "GalleryImage" ADD CONSTRAINT "GalleryImage_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
