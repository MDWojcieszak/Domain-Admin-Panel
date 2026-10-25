-- Process.startedById became optional (20261006210000_deploy_automatic_starters)
-- without its foreign key following: an optional relation sets null when the
-- user is deleted instead of refusing the delete. Brings the database in line
-- with the schema; no data changes.
ALTER TABLE "Process" DROP CONSTRAINT "Process_startedById_fkey";
ALTER TABLE "Process" ADD CONSTRAINT "Process_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
