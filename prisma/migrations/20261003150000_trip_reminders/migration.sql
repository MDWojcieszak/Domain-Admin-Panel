-- Pre-trip reminders (docs/photo-entry-planning-and-publish.md §7).

ALTER TABLE "UserSettings" ADD COLUMN "tripEmailNotifications" BOOLEAN NOT NULL DEFAULT true;
