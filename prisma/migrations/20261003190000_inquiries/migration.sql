-- Contact inquiries from the public portfolio, managed in the panel, with the
-- contact form configuration (administrator, per-language privacy notice, retention).

-- CreateEnum
CREATE TYPE "InquiryTopic" AS ENUM ('SESSION', 'PRINT', 'LICENSE', 'COLLABORATION', 'OTHER');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'READ', 'ANSWERED', 'ARCHIVED', 'SPAM');

-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN     "inquiryEmailNotifications" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Inquiry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "topic" "InquiryTopic" NOT NULL,
    "message" TEXT NOT NULL,
    "galleryId" TEXT,
    "imageId" TEXT,
    "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
    "readAt" TIMESTAMP(3),
    "answeredAt" TIMESTAMP(3),
    "internalNote" TEXT,
    "noticeAcknowledgedAt" TIMESTAMP(3) NOT NULL,
    "privacyNoticeLocale" TEXT NOT NULL,
    "privacyNoticeVersion" INTEGER NOT NULL,
    "locale" TEXT NOT NULL,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactSettings" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "administratorName" TEXT,
    "administratorEmail" TEXT,
    "administratorAddress" TEXT,
    "topics" "InquiryTopic"[],
    "retentionDays" INTEGER NOT NULL DEFAULT 365,
    "spamRetentionDays" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactSettingsTranslation" (
    "id" TEXT NOT NULL,
    "settingsId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "intro" TEXT,
    "privacyNotice" TEXT,
    "privacyNoticeVersion" INTEGER NOT NULL DEFAULT 0,
    "privacyNoticeUpdatedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactSettingsTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Inquiry_status_createdAt_idx" ON "Inquiry"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Inquiry_galleryId_idx" ON "Inquiry"("galleryId");

-- CreateIndex
CREATE UNIQUE INDEX "ContactSettingsTranslation_settingsId_locale_key" ON "ContactSettingsTranslation"("settingsId", "locale");

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactSettingsTranslation" ADD CONSTRAINT "ContactSettingsTranslation_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "ContactSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

