-- An application can carry its own compose file instead of a spec.
ALTER TYPE "AppSourceType" ADD VALUE 'COMPOSE';
ALTER TABLE "Application" ADD COLUMN "compose" TEXT;
