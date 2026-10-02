-- Phase 4 of docs/photo-entry-redesign.md: reminders about unsecured media.
-- Additive only; no backfill (no row has been reminded yet).

ALTER TABLE "PhotoEntryGear" ADD COLUMN "remindedAt" TIMESTAMP(3);

ALTER TABLE "UserSettings" ADD COLUMN "photoMediaEmailNotifications" BOOLEAN NOT NULL DEFAULT true;
