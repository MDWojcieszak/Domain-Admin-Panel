-- DropForeignKey
ALTER TABLE "HomeBlock" DROP CONSTRAINT "HomeBlock_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "HomeBlock" DROP CONSTRAINT "HomeBlock_imageId_fkey";

-- DropForeignKey
ALTER TABLE "HomeBlock" DROP CONSTRAINT "HomeBlock_layoutId_fkey";

-- DropForeignKey
ALTER TABLE "HomeBlockPost" DROP CONSTRAINT "HomeBlockPost_blockId_fkey";

-- DropForeignKey
ALTER TABLE "HomeBlockPost" DROP CONSTRAINT "HomeBlockPost_postId_fkey";

-- DropForeignKey
ALTER TABLE "HomeBlockTranslation" DROP CONSTRAINT "HomeBlockTranslation_blockId_fkey";

-- AlterTable
ALTER TABLE "BlogPost" ADD COLUMN     "homePosition" INTEGER;

-- DropTable
DROP TABLE "HomeBlock";

-- DropTable
DROP TABLE "HomeBlockPost";

-- DropTable
DROP TABLE "HomeBlockTranslation";

-- DropTable
DROP TABLE "HomeLayout";

-- DropEnum
DROP TYPE "HomeBlockType";

-- CreateTable
CREATE TABLE "HomeConfig" (
    "id" TEXT NOT NULL,
    "postCount" INTEGER NOT NULL DEFAULT 12,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_homePosition_key" ON "BlogPost"("homePosition");
