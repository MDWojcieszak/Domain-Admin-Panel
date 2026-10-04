-- The deploy agent is no longer a registered server, so an application no
-- longer hangs off a server category. Categories created for applications
-- (by adoption or creation) are left in place; nothing references them now.
ALTER TABLE "Application" DROP CONSTRAINT "Application_serverCategoryId_fkey";
DROP INDEX "Application_serverCategoryId_key";
ALTER TABLE "Application" DROP COLUMN "serverCategoryId";
