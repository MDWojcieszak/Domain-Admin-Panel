-- CreateEnum
CREATE TYPE "BuildMode" AS ENUM ('COMPOSE', 'REGISTRY', 'NONE');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "buildMode" "BuildMode" NOT NULL DEFAULT 'REGISTRY';

