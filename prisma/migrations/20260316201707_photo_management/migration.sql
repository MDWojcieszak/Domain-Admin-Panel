-- CreateEnum
CREATE TYPE "PhotoEntryType" AS ENUM ('GENERAL', 'WORK', 'ASTRO');

-- CreateEnum
CREATE TYPE "PhotoEntryStatus" AS ENUM ('PLANNED', 'ACTIVE', 'IMPORTED', 'SELECTED', 'EDITING', 'COMPLETED');

-- CreateTable
CREATE TABLE "AstroObject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "code" TEXT,
    "aliases" TEXT,
    "description" TEXT,
    "thumbnailUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AstroObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoEntry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "PhotoEntryType" NOT NULL DEFAULT 'GENERAL',
    "status" "PhotoEntryStatus" NOT NULL DEFAULT 'PLANNED',
    "year" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "daysCount" INTEGER NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "rootPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "PhotoEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoEntryAstroObject" (
    "id" TEXT NOT NULL,
    "photoEntryId" TEXT NOT NULL,
    "astroObjectId" TEXT NOT NULL,
    "rootPath" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhotoEntryAstroObject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AstroObject_slug_key" ON "AstroObject"("slug");

-- CreateIndex
CREATE INDEX "PhotoEntry_userId_type_idx" ON "PhotoEntry"("userId", "type");

-- CreateIndex
CREATE INDEX "PhotoEntry_userId_year_idx" ON "PhotoEntry"("userId", "year");

-- CreateIndex
CREATE INDEX "PhotoEntry_userId_startDate_idx" ON "PhotoEntry"("userId", "startDate");

-- CreateIndex
CREATE INDEX "PhotoEntry_userId_status_idx" ON "PhotoEntry"("userId", "status");

-- CreateIndex
CREATE INDEX "PhotoEntryAstroObject_astroObjectId_idx" ON "PhotoEntryAstroObject"("astroObjectId");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoEntryAstroObject_photoEntryId_astroObjectId_key" ON "PhotoEntryAstroObject"("photoEntryId", "astroObjectId");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoEntryAstroObject_photoEntryId_rootPath_key" ON "PhotoEntryAstroObject"("photoEntryId", "rootPath");

-- AddForeignKey
ALTER TABLE "PhotoEntry" ADD CONSTRAINT "PhotoEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoEntryAstroObject" ADD CONSTRAINT "PhotoEntryAstroObject_photoEntryId_fkey" FOREIGN KEY ("photoEntryId") REFERENCES "PhotoEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoEntryAstroObject" ADD CONSTRAINT "PhotoEntryAstroObject_astroObjectId_fkey" FOREIGN KEY ("astroObjectId") REFERENCES "AstroObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
