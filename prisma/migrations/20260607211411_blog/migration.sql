-- CreateEnum
CREATE TYPE "ImageScope" AS ENUM ('GALLERY', 'BLOG');

-- CreateEnum
CREATE TYPE "BlogPostStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BlogAuthorRole" AS ENUM ('AUTHOR', 'CO_AUTHOR');

-- CreateEnum
CREATE TYPE "BlogAccessTier" AS ENUM ('PUBLIC', 'REGISTERED', 'PREMIUM');

-- CreateEnum
CREATE TYPE "VersionState" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BlogSectionType" AS ENUM ('HEADING', 'PARAGRAPH', 'QUOTE', 'CALLOUT', 'LIST', 'IMAGE', 'GALLERY', 'MAP', 'PLACE', 'EMBED', 'DIVIDER', 'COLUMNS', 'COLUMN');

-- CreateEnum
CREATE TYPE "BlogFeedbackRating" AS ENUM ('HELPFUL', 'NOT_HELPFUL');

-- CreateEnum
CREATE TYPE "CalloutVariant" AS ENUM ('INFO', 'TIP', 'WARNING', 'SUCCESS');

-- CreateEnum
CREATE TYPE "EmbedProvider" AS ENUM ('YOUTUBE', 'VIMEO', 'SPOTIFY', 'X', 'OTHER');

-- CreateEnum
CREATE TYPE "GalleryLayout" AS ENUM ('GRID', 'CAROUSEL', 'MASONRY', 'FULLWIDTH');

-- CreateEnum
CREATE TYPE "BlogImageSize" AS ENUM ('SMALL', 'MEDIUM', 'LARGE', 'FULL', 'FULL_BLEED');

-- CreateEnum
CREATE TYPE "BlogAspectRatio" AS ENUM ('ORIGINAL', 'SQUARE', 'RATIO_4_3', 'RATIO_3_2', 'RATIO_16_9', 'RATIO_21_9', 'RATIO_65_24', 'RATIO_3_4', 'RATIO_2_3', 'RATIO_4_5', 'RATIO_9_16');

-- CreateEnum
CREATE TYPE "BlogOverlayPosition" AS ENUM ('TOP_LEFT', 'TOP_CENTER', 'TOP_RIGHT', 'MIDDLE_LEFT', 'MIDDLE_CENTER', 'MIDDLE_RIGHT', 'BOTTOM_LEFT', 'BOTTOM_CENTER', 'BOTTOM_RIGHT');

-- CreateEnum
CREATE TYPE "BlogOverlayTheme" AS ENUM ('LIGHT', 'DARK');

-- CreateEnum
CREATE TYPE "BlogOverlayBackdrop" AS ENUM ('NONE', 'SCRIM', 'GRADIENT', 'GLASS');

-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('POST', 'ATTRACTION');

-- CreateEnum
CREATE TYPE "PoiPriceLevel" AS ENUM ('FREE', 'LOW', 'MODERATE', 'HIGH');

-- CreateEnum
CREATE TYPE "PoiSeason" AS ENUM ('SPRING', 'SUMMER', 'AUTUMN', 'WINTER');

-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');

-- CreateEnum
CREATE TYPE "PoiDifficulty" AS ENUM ('EASY', 'MODERATE', 'HARD', 'EXPERT');

-- CreateEnum
CREATE TYPE "PoiVerdict" AS ENUM ('LOVED', 'LIKED', 'MIXED', 'DISLIKED', 'SKIP');

-- CreateEnum
CREATE TYPE "PoiStatus" AS ENUM ('ACTIVE', 'TEMPORARILY_CLOSED', 'PERMANENTLY_CLOSED');

-- CreateEnum
CREATE TYPE "AccessGrantSource" AS ENUM ('APP_PURCHASE', 'SUBSCRIPTION', 'MANUAL', 'REDEEM_CODE');

-- CreateEnum
CREATE TYPE "AppPlatform" AS ENUM ('IOS', 'ANDROID');

-- AlterTable
ALTER TABLE "Image" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "scope" "ImageScope" NOT NULL DEFAULT 'GALLERY',
ADD COLUMN     "uploadedById" TEXT;

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

-- CreateTable
CREATE TABLE "BlogPost" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "BlogPostStatus" NOT NULL DEFAULT 'DRAFT',
    "accessTier" "BlogAccessTier" NOT NULL DEFAULT 'PUBLIC',
    "order" INTEGER,
    "homePosition" INTEGER,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "notHelpfulCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "seriesId" TEXT,
    "seriesOrder" INTEGER,
    "firstPublishedAt" TIMESTAMP(3),
    "lastPublishedAt" TIMESTAMP(3),
    "scheduledFor" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "draftVersionId" TEXT,
    "publishedVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogPostVersion" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "state" "VersionState" NOT NULL DEFAULT 'DRAFT',
    "coverImageId" TEXT,
    "ogImageId" TEXT,
    "country" TEXT,
    "region" TEXT,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogPostVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogSection" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "type" "BlogSectionType" NOT NULL,
    "order" INTEGER NOT NULL,
    "minAccessTier" "BlogAccessTier" NOT NULL DEFAULT 'PUBLIC',
    "headingLevel" INTEGER,
    "quoteAuthor" TEXT,
    "calloutVariant" "CalloutVariant",
    "galleryLayout" "GalleryLayout",
    "embedUrl" TEXT,
    "embedProvider" "EmbedProvider",
    "parentId" TEXT,
    "columnWidth" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogSectionImage" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "size" "BlogImageSize" NOT NULL DEFAULT 'LARGE',
    "aspectRatio" "BlogAspectRatio" NOT NULL DEFAULT 'ORIGINAL',
    "focalX" DOUBLE PRECISION,
    "focalY" DOUBLE PRECISION,
    "overlayPosition" "BlogOverlayPosition",
    "overlayTheme" "BlogOverlayTheme",
    "overlayBackdrop" "BlogOverlayBackdrop",

    CONSTRAINT "BlogSectionImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogSectionListItem" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BlogSectionListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectionPoi" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "poiId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SectionPoi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Poi" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "address" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "timezone" TEXT,
    "googlePlaceId" TEXT,
    "osmId" TEXT,
    "visitDurationMin" INTEGER,
    "creatorRating" INTEGER,
    "creatorVerdict" "PoiVerdict",
    "internalNote" TEXT,
    "priceLevel" "PoiPriceLevel",
    "bestSeasons" "PoiSeason"[],
    "websiteUrl" TEXT,
    "bookingUrl" TEXT,
    "mapsUrl" TEXT,
    "difficulty" "PoiDifficulty",
    "distanceKm" DOUBLE PRECISION,
    "elevationGainM" INTEGER,
    "status" "PoiStatus" NOT NULL DEFAULT 'ACTIVE',
    "coverImageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Poi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoiCategory" (
    "id" TEXT NOT NULL,
    "poiId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "PoiCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoiImage" (
    "id" TEXT NOT NULL,
    "poiId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PoiImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoiHours" (
    "id" TEXT NOT NULL,
    "poiId" TEXT NOT NULL,
    "weekday" "Weekday" NOT NULL,
    "opensAt" TEXT,
    "closesAt" TEXT,
    "closed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PoiHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "kind" "CategoryKind" NOT NULL,
    "key" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogVersionCategory" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "BlogVersionCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogPostLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlogPostLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogPostView" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlogPostView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeConfig" (
    "id" TEXT NOT NULL,
    "postCount" INTEGER NOT NULL DEFAULT 12,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogEditorialComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "sectionId" TEXT,
    "anchorStart" INTEGER,
    "anchorEnd" INTEGER,
    "quote" TEXT,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogEditorialComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogPostFeedback" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT,
    "rating" "BlogFeedbackRating" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlogPostFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogLocale" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogLocale_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "BlogPostVersionTranslation" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "excerpt" TEXT,
    "seoKeywords" TEXT[],
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "canonicalUrl" TEXT,
    "wordCount" INTEGER,
    "readingMinutes" INTEGER,

    CONSTRAINT "BlogPostVersionTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogSectionTranslation" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "keywords" TEXT[],

    CONSTRAINT "BlogSectionTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogSectionImageTranslation" (
    "id" TEXT NOT NULL,
    "sectionImageId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "caption" TEXT,
    "alt" TEXT,
    "overlayText" TEXT,

    CONSTRAINT "BlogSectionImageTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogSectionListItemTranslation" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "content" TEXT,

    CONSTRAINT "BlogSectionListItemTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoiTranslation" (
    "id" TEXT NOT NULL,
    "poiId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,

    CONSTRAINT "PoiTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryTranslation" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "label" TEXT,

    CONSTRAINT "CategoryTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogSearchDocument" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT,
    "excerpt" TEXT,
    "body" TEXT,
    "keywords" TEXT[],
    "searchVector" tsvector,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogSearchDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" "BlogAccessTier" NOT NULL,
    "source" "AccessGrantSource" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "platform" "AppPlatform" NOT NULL,
    "name" TEXT,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "licenseExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RedeemCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "tier" "BlogAccessTier" NOT NULL DEFAULT 'PREMIUM',
    "durationDays" INTEGER,
    "redeemedById" TEXT,
    "redeemedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RedeemCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogPostAuthor" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "BlogAuthorRole" NOT NULL DEFAULT 'AUTHOR',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BlogPostAuthor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogSeries" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "coverImageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogSeriesTranslation" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,

    CONSTRAINT "BlogSeriesTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoiCollection" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "country" TEXT,
    "region" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "coverImageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PoiCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoiCollectionItem" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "poiId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "PoiCollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoiCollectionTranslation" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,

    CONSTRAINT "PoiCollectionTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlogMediaAlbum_createdById_idx" ON "BlogMediaAlbum"("createdById");

-- CreateIndex
CREATE INDEX "BlogMediaAlbumItem_albumId_order_idx" ON "BlogMediaAlbumItem"("albumId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "BlogMediaAlbumItem_albumId_imageId_key" ON "BlogMediaAlbumItem"("albumId", "imageId");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_homePosition_key" ON "BlogPost"("homePosition");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_draftVersionId_key" ON "BlogPost"("draftVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_publishedVersionId_key" ON "BlogPost"("publishedVersionId");

-- CreateIndex
CREATE INDEX "BlogPost_status_firstPublishedAt_idx" ON "BlogPost"("status", "firstPublishedAt");

-- CreateIndex
CREATE INDEX "BlogPost_status_scheduledFor_idx" ON "BlogPost"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "BlogPost_createdById_idx" ON "BlogPost"("createdById");

-- CreateIndex
CREATE INDEX "BlogPost_order_idx" ON "BlogPost"("order");

-- CreateIndex
CREATE INDEX "BlogPostVersion_postId_state_idx" ON "BlogPostVersion"("postId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPostVersion_postId_versionNumber_key" ON "BlogPostVersion"("postId", "versionNumber");

-- CreateIndex
CREATE INDEX "BlogSection_versionId_order_idx" ON "BlogSection"("versionId", "order");

-- CreateIndex
CREATE INDEX "BlogSection_parentId_order_idx" ON "BlogSection"("parentId", "order");

-- CreateIndex
CREATE INDEX "BlogSectionImage_sectionId_order_idx" ON "BlogSectionImage"("sectionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "BlogSectionImage_sectionId_imageId_key" ON "BlogSectionImage"("sectionId", "imageId");

-- CreateIndex
CREATE INDEX "BlogSectionListItem_sectionId_order_idx" ON "BlogSectionListItem"("sectionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "SectionPoi_sectionId_poiId_key" ON "SectionPoi"("sectionId", "poiId");

-- CreateIndex
CREATE UNIQUE INDEX "Poi_googlePlaceId_key" ON "Poi"("googlePlaceId");

-- CreateIndex
CREATE INDEX "PoiCategory_categoryId_idx" ON "PoiCategory"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "PoiCategory_poiId_categoryId_key" ON "PoiCategory"("poiId", "categoryId");

-- CreateIndex
CREATE INDEX "PoiImage_poiId_order_idx" ON "PoiImage"("poiId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "PoiImage_poiId_imageId_key" ON "PoiImage"("poiId", "imageId");

-- CreateIndex
CREATE UNIQUE INDEX "PoiHours_poiId_weekday_key" ON "PoiHours"("poiId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "Category_kind_key_key" ON "Category"("kind", "key");

-- CreateIndex
CREATE INDEX "BlogVersionCategory_categoryId_idx" ON "BlogVersionCategory"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "BlogVersionCategory_versionId_categoryId_key" ON "BlogVersionCategory"("versionId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPostLike_postId_userId_key" ON "BlogPostLike"("postId", "userId");

-- CreateIndex
CREATE INDEX "BlogPostView_postId_createdAt_idx" ON "BlogPostView"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "BlogEditorialComment_postId_idx" ON "BlogEditorialComment"("postId");

-- CreateIndex
CREATE INDEX "BlogEditorialComment_sectionId_idx" ON "BlogEditorialComment"("sectionId");

-- CreateIndex
CREATE INDEX "BlogPostFeedback_postId_rating_idx" ON "BlogPostFeedback"("postId", "rating");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPostFeedback_postId_userId_key" ON "BlogPostFeedback"("postId", "userId");

-- CreateIndex
CREATE INDEX "BlogPostVersionTranslation_locale_idx" ON "BlogPostVersionTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPostVersionTranslation_versionId_locale_key" ON "BlogPostVersionTranslation"("versionId", "locale");

-- CreateIndex
CREATE INDEX "BlogSectionTranslation_locale_idx" ON "BlogSectionTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "BlogSectionTranslation_sectionId_locale_key" ON "BlogSectionTranslation"("sectionId", "locale");

-- CreateIndex
CREATE INDEX "BlogSectionImageTranslation_locale_idx" ON "BlogSectionImageTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "BlogSectionImageTranslation_sectionImageId_locale_key" ON "BlogSectionImageTranslation"("sectionImageId", "locale");

-- CreateIndex
CREATE INDEX "BlogSectionListItemTranslation_locale_idx" ON "BlogSectionListItemTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "BlogSectionListItemTranslation_itemId_locale_key" ON "BlogSectionListItemTranslation"("itemId", "locale");

-- CreateIndex
CREATE INDEX "PoiTranslation_locale_idx" ON "PoiTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "PoiTranslation_poiId_locale_key" ON "PoiTranslation"("poiId", "locale");

-- CreateIndex
CREATE INDEX "CategoryTranslation_locale_idx" ON "CategoryTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryTranslation_categoryId_locale_key" ON "CategoryTranslation"("categoryId", "locale");

-- CreateIndex
CREATE INDEX "BlogSearchDocument_locale_idx" ON "BlogSearchDocument"("locale");

-- CreateIndex
CREATE INDEX "BlogSearchDocument_searchVector_idx" ON "BlogSearchDocument" USING GIN ("searchVector");

-- CreateIndex
CREATE UNIQUE INDEX "BlogSearchDocument_postId_locale_key" ON "BlogSearchDocument"("postId", "locale");

-- CreateIndex
CREATE INDEX "AccessGrant_userId_tier_idx" ON "AccessGrant"("userId", "tier");

-- CreateIndex
CREATE INDEX "AccessGrant_expiresAt_idx" ON "AccessGrant"("expiresAt");

-- CreateIndex
CREATE INDEX "AppDevice_userId_idx" ON "AppDevice"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AppDevice_userId_installationId_key" ON "AppDevice"("userId", "installationId");

-- CreateIndex
CREATE UNIQUE INDEX "RedeemCode_code_key" ON "RedeemCode"("code");

-- CreateIndex
CREATE INDEX "RedeemCode_redeemedById_idx" ON "RedeemCode"("redeemedById");

-- CreateIndex
CREATE INDEX "BlogPostAuthor_userId_idx" ON "BlogPostAuthor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPostAuthor_postId_userId_key" ON "BlogPostAuthor"("postId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "BlogSeries_slug_key" ON "BlogSeries"("slug");

-- CreateIndex
CREATE INDEX "BlogSeriesTranslation_locale_idx" ON "BlogSeriesTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "BlogSeriesTranslation_seriesId_locale_key" ON "BlogSeriesTranslation"("seriesId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "PoiCollection_slug_key" ON "PoiCollection"("slug");

-- CreateIndex
CREATE INDEX "PoiCollectionItem_collectionId_rank_idx" ON "PoiCollectionItem"("collectionId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "PoiCollectionItem_collectionId_poiId_key" ON "PoiCollectionItem"("collectionId", "poiId");

-- CreateIndex
CREATE INDEX "PoiCollectionTranslation_locale_idx" ON "PoiCollectionTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "PoiCollectionTranslation_collectionId_locale_key" ON "PoiCollectionTranslation"("collectionId", "locale");

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

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "BlogSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_draftVersionId_fkey" FOREIGN KEY ("draftVersionId") REFERENCES "BlogPostVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "BlogPostVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPostVersion" ADD CONSTRAINT "BlogPostVersion_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BlogPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPostVersion" ADD CONSTRAINT "BlogPostVersion_coverImageId_fkey" FOREIGN KEY ("coverImageId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPostVersion" ADD CONSTRAINT "BlogPostVersion_ogImageId_fkey" FOREIGN KEY ("ogImageId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogSection" ADD CONSTRAINT "BlogSection_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "BlogPostVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogSection" ADD CONSTRAINT "BlogSection_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "BlogSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogSectionImage" ADD CONSTRAINT "BlogSectionImage_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "BlogSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogSectionImage" ADD CONSTRAINT "BlogSectionImage_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogSectionListItem" ADD CONSTRAINT "BlogSectionListItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "BlogSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionPoi" ADD CONSTRAINT "SectionPoi_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "BlogSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionPoi" ADD CONSTRAINT "SectionPoi_poiId_fkey" FOREIGN KEY ("poiId") REFERENCES "Poi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poi" ADD CONSTRAINT "Poi_coverImageId_fkey" FOREIGN KEY ("coverImageId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoiCategory" ADD CONSTRAINT "PoiCategory_poiId_fkey" FOREIGN KEY ("poiId") REFERENCES "Poi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoiCategory" ADD CONSTRAINT "PoiCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoiImage" ADD CONSTRAINT "PoiImage_poiId_fkey" FOREIGN KEY ("poiId") REFERENCES "Poi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoiImage" ADD CONSTRAINT "PoiImage_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoiHours" ADD CONSTRAINT "PoiHours_poiId_fkey" FOREIGN KEY ("poiId") REFERENCES "Poi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogVersionCategory" ADD CONSTRAINT "BlogVersionCategory_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "BlogPostVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogVersionCategory" ADD CONSTRAINT "BlogVersionCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPostLike" ADD CONSTRAINT "BlogPostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BlogPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPostLike" ADD CONSTRAINT "BlogPostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPostView" ADD CONSTRAINT "BlogPostView_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BlogPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPostView" ADD CONSTRAINT "BlogPostView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogEditorialComment" ADD CONSTRAINT "BlogEditorialComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BlogPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogEditorialComment" ADD CONSTRAINT "BlogEditorialComment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "BlogSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogEditorialComment" ADD CONSTRAINT "BlogEditorialComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPostFeedback" ADD CONSTRAINT "BlogPostFeedback_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BlogPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPostFeedback" ADD CONSTRAINT "BlogPostFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPostVersionTranslation" ADD CONSTRAINT "BlogPostVersionTranslation_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "BlogPostVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogSectionTranslation" ADD CONSTRAINT "BlogSectionTranslation_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "BlogSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogSectionImageTranslation" ADD CONSTRAINT "BlogSectionImageTranslation_sectionImageId_fkey" FOREIGN KEY ("sectionImageId") REFERENCES "BlogSectionImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogSectionListItemTranslation" ADD CONSTRAINT "BlogSectionListItemTranslation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "BlogSectionListItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoiTranslation" ADD CONSTRAINT "PoiTranslation_poiId_fkey" FOREIGN KEY ("poiId") REFERENCES "Poi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryTranslation" ADD CONSTRAINT "CategoryTranslation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogSearchDocument" ADD CONSTRAINT "BlogSearchDocument_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BlogPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppDevice" ADD CONSTRAINT "AppDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedeemCode" ADD CONSTRAINT "RedeemCode_redeemedById_fkey" FOREIGN KEY ("redeemedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPostAuthor" ADD CONSTRAINT "BlogPostAuthor_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BlogPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPostAuthor" ADD CONSTRAINT "BlogPostAuthor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogSeries" ADD CONSTRAINT "BlogSeries_coverImageId_fkey" FOREIGN KEY ("coverImageId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogSeriesTranslation" ADD CONSTRAINT "BlogSeriesTranslation_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "BlogSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoiCollection" ADD CONSTRAINT "PoiCollection_coverImageId_fkey" FOREIGN KEY ("coverImageId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoiCollectionItem" ADD CONSTRAINT "PoiCollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "PoiCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoiCollectionItem" ADD CONSTRAINT "PoiCollectionItem_poiId_fkey" FOREIGN KEY ("poiId") REFERENCES "Poi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoiCollectionTranslation" ADD CONSTRAINT "PoiCollectionTranslation_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "PoiCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
