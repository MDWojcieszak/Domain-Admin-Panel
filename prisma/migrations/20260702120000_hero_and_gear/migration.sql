-- Homepage hero curation (HeroImage) + photographer gear (GearItem).
-- Idempotent — safe on fresh & existing DBs.

-- ---------- Enum ----------
DO $$ BEGIN
  CREATE TYPE "GearCategory" AS ENUM ('CAMERA', 'LENS', 'TRIPOD', 'BAG', 'LIGHTING', 'ACCESSORY', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------- HeroImage: hand-picked homepage selection ----------
CREATE TABLE IF NOT EXISTS "HeroImage" (
    "id" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HeroImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HeroImage_imageId_key" ON "HeroImage"("imageId");
CREATE INDEX IF NOT EXISTS "HeroImage_order_idx" ON "HeroImage"("order");

DO $$ BEGIN
  ALTER TABLE "HeroImage" ADD CONSTRAINT "HeroImage_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------- GearSystem: camera systems / formats (grouping + rationale) ----------
CREATE TABLE IF NOT EXISTS "GearSystem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT,
    "description" TEXT,
    "imageId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GearSystem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GearSystem_visible_order_idx" ON "GearSystem"("visible", "order");

DO $$ BEGIN
  ALTER TABLE "GearSystem" ADD CONSTRAINT "GearSystem_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------- GearItem: photographer's current kit ----------
CREATE TABLE IF NOT EXISTS "GearItem" (
    "id" TEXT NOT NULL,
    "category" "GearCategory" NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "description" TEXT,
    "systemId" TEXT,
    "imageId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GearItem_pkey" PRIMARY KEY ("id")
);

-- `systemId` added defensively in case the table pre-exists from an earlier run.
ALTER TABLE "GearItem" ADD COLUMN IF NOT EXISTS "systemId" TEXT;

CREATE INDEX IF NOT EXISTS "GearItem_visible_category_order_idx" ON "GearItem"("visible", "category", "order");
CREATE INDEX IF NOT EXISTS "GearItem_systemId_idx" ON "GearItem"("systemId");

DO $$ BEGIN
  ALTER TABLE "GearItem" ADD CONSTRAINT "GearItem_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "GearItem" ADD CONSTRAINT "GearItem_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "GearSystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
