-- Portfolio home settings (singleton) + per-gallery homepage overrides.
-- Idempotent — safe on fresh & existing DBs.

-- ---------- Gallery: homepage presentation overrides ----------
ALTER TABLE "Gallery" ADD COLUMN IF NOT EXISTS "showOnHome" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Gallery" ADD COLUMN IF NOT EXISTS "homePreviewCount" INTEGER;

-- ---------- PortfolioSettings: singleton home config ----------
CREATE TABLE IF NOT EXISTS "PortfolioSettings" (
    "id" TEXT NOT NULL,
    "heroLimit" INTEGER NOT NULL DEFAULT 12,
    "galleryPreviewCount" INTEGER NOT NULL DEFAULT 6,
    "homeGalleryLimit" INTEGER,
    "galleryPageSize" INTEGER NOT NULL DEFAULT 24,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioSettings_pkey" PRIMARY KEY ("id")
);
