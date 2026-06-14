-- AlterTable
ALTER TABLE "BlogPostVersion" DROP COLUMN "country",
ADD COLUMN     "countryId" TEXT;

-- AlterTable
ALTER TABLE "Poi" DROP COLUMN "country",
ADD COLUMN     "countryId" TEXT;

-- CreateTable
CREATE TABLE "BlogCountry" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "code" TEXT,
    "coverImageId" TEXT,
    "order" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogCountry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogCountryTranslation" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "intro" TEXT,

    CONSTRAINT "BlogCountryTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlogCountry_slug_key" ON "BlogCountry"("slug");

-- CreateIndex
CREATE INDEX "BlogCountryTranslation_locale_idx" ON "BlogCountryTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "BlogCountryTranslation_countryId_locale_key" ON "BlogCountryTranslation"("countryId", "locale");

-- AddForeignKey
ALTER TABLE "BlogPostVersion" ADD CONSTRAINT "BlogPostVersion_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "BlogCountry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poi" ADD CONSTRAINT "Poi_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "BlogCountry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogCountry" ADD CONSTRAINT "BlogCountry_coverImageId_fkey" FOREIGN KEY ("coverImageId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogCountryTranslation" ADD CONSTRAINT "BlogCountryTranslation_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "BlogCountry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
