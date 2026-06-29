-- CreateEnum
CREATE TYPE "ImmichAlbumSource" AS ENUM ('EXPORT', 'EDIT', 'SELECTS', 'SOURCE', 'DELIVERY', 'ENTIRE');

-- AlterTable: store the connected-service base URL (e.g. Immich endpoint) and
-- external library root path (e.g. /media/vault) as columns
ALTER TABLE "ApiKey" ADD COLUMN     "baseUrl" TEXT;
ALTER TABLE "ApiKey" ADD COLUMN     "libraryPath" TEXT;

-- CreateTable
CREATE TABLE "PhotoEntryImmichAlbum" (
    "id" TEXT NOT NULL,
    "photoEntryId" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "albumName" TEXT NOT NULL,
    "source" "ImmichAlbumSource" NOT NULL DEFAULT 'EXPORT',
    "sourcePaths" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "lastAssetCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhotoEntryImmichAlbum_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhotoEntryImmichAlbum_photoEntryId_idx" ON "PhotoEntryImmichAlbum"("photoEntryId");

-- CreateIndex
CREATE INDEX "PhotoEntryImmichAlbum_albumId_idx" ON "PhotoEntryImmichAlbum"("albumId");

-- AddForeignKey
ALTER TABLE "PhotoEntryImmichAlbum" ADD CONSTRAINT "PhotoEntryImmichAlbum_photoEntryId_fkey" FOREIGN KEY ("photoEntryId") REFERENCES "PhotoEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
