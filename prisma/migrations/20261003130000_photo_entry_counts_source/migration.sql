-- Phase 6 of docs/photo-entry-redesign.md: provenance of the progress counts,
-- so an automatic folder scan never overwrites a newer reported value.

CREATE TYPE "PhotoEntryCountsSource" AS ENUM ('REPORTED', 'SCANNED');

ALTER TABLE "PhotoEntry" ADD COLUMN "countsSource" "PhotoEntryCountsSource",
ADD COLUMN "countsUpdatedAt" TIMESTAMP(3);

-- Counts written before this migration were reported by hand or by the app.
UPDATE "PhotoEntry"
   SET "countsSource" = 'REPORTED', "countsUpdatedAt" = "updatedAt"
 WHERE "photoCount" IS NOT NULL OR "selectedCount" IS NOT NULL OR "editedCount" IS NOT NULL;
