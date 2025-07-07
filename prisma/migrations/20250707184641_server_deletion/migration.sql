-- AlterTable
ALTER TABLE "Server" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "macAddress" TEXT;

-- AlterTable
ALTER TABLE "ServerProperties" ADD COLUMN     "stoppedById" TEXT;

-- AddForeignKey
ALTER TABLE "ServerProperties" ADD CONSTRAINT "ServerProperties_stoppedById_fkey" FOREIGN KEY ("stoppedById") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
