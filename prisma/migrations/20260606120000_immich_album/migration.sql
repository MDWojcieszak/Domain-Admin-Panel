-- CreateTable
CREATE TABLE "PhotoEntryImmichAlbum" (
    "id" TEXT NOT NULL,
    "photoEntryId" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "albumName" TEXT NOT NULL,
    "sourcePaths" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "lastAssetCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhotoEntryImmichAlbum_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PhotoEntryImmichAlbum_photoEntryId_key" ON "PhotoEntryImmichAlbum"("photoEntryId");

-- CreateIndex
CREATE INDEX "PhotoEntryImmichAlbum_albumId_idx" ON "PhotoEntryImmichAlbum"("albumId");

-- AddForeignKey
ALTER TABLE "PhotoEntryImmichAlbum" ADD CONSTRAINT "PhotoEntryImmichAlbum_photoEntryId_fkey" FOREIGN KEY ("photoEntryId") REFERENCES "PhotoEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
