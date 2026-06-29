-- Repair migration.
--
-- `20260606120000_immich_album` was edited AFTER it had already been applied to
-- existing databases (prod). `prisma migrate deploy` never re-runs an
-- already-recorded migration, so the columns/enum/index added by that edit were
-- silently skipped on those DBs (only fresh DBs got them). This migration
-- re-applies everything idempotently, so it's a no-op where it already exists
-- and a fix where it doesn't.

-- Enum (CREATE TYPE has no IF NOT EXISTS — guard with a DO block).
DO $$ BEGIN
  CREATE TYPE "ImmichAlbumSource" AS ENUM ('EXPORT', 'EDIT', 'SELECTS', 'SOURCE', 'DELIVERY', 'ENTIRE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Connected-service columns on ApiKey.
ALTER TABLE "ApiKey" ADD COLUMN IF NOT EXISTS "baseUrl" TEXT;
ALTER TABLE "ApiKey" ADD COLUMN IF NOT EXISTS "libraryPath" TEXT;

-- Album link columns.
ALTER TABLE "PhotoEntryImmichAlbum" ADD COLUMN IF NOT EXISTS "source" "ImmichAlbumSource" NOT NULL DEFAULT 'EXPORT';
ALTER TABLE "PhotoEntryImmichAlbum" ADD COLUMN IF NOT EXISTS "astroObjectId" TEXT;

-- Multiple albums per entry: drop the legacy unique on photoEntryId, keep a plain index.
DROP INDEX IF EXISTS "PhotoEntryImmichAlbum_photoEntryId_key";
CREATE INDEX IF NOT EXISTS "PhotoEntryImmichAlbum_photoEntryId_idx" ON "PhotoEntryImmichAlbum"("photoEntryId");
