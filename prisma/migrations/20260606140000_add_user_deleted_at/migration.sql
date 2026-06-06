-- Soft-delete marker for user accounts.
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
