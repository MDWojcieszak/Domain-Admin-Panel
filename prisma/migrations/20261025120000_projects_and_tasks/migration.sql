-- Projects, tasks and sharing (docs/projects-design.md, phase 1).
--
-- Rebuilds the task domain that existed only as a schema since 2025-07: no
-- code ever wrote to these tables. The guard below refuses to run if that
-- assumption is wrong anywhere, instead of dropping someone's data.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Task")
     OR EXISTS (SELECT 1 FROM "TaskComment")
     OR EXISTS (SELECT 1 FROM "Attachment")
     OR EXISTS (SELECT 1 FROM "Achievement")
     OR EXISTS (SELECT 1 FROM "TaskCollaborator") THEN
    RAISE EXCEPTION 'The old task tables hold data; migrate it before rebuilding the task domain.';
  END IF;
END $$;

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('GENERAL', 'LIST', 'TRIP', 'DIY');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNED', 'ACTIVE', 'ON_HOLD', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "StatusCategory" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- DropForeignKey
ALTER TABLE "Achievement" DROP CONSTRAINT "Achievement_aiContextId_fkey";

-- DropForeignKey
ALTER TABLE "Achievement" DROP CONSTRAINT "Achievement_taskId_fkey";

-- DropForeignKey
ALTER TABLE "Achievement" DROP CONSTRAINT "Achievement_userId_fkey";

-- DropForeignKey
ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_aiContextId_fkey";

-- DropForeignKey
ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_taskId_fkey";

-- DropForeignKey
ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_uploadedById_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_aiContextId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_personId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_placeId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_userId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "fk_task_parentTaskId";

-- DropForeignKey
ALTER TABLE "TaskActivity" DROP CONSTRAINT "TaskActivity_taskId_fkey";

-- DropForeignKey
ALTER TABLE "TaskActivity" DROP CONSTRAINT "TaskActivity_userId_fkey";

-- DropForeignKey
ALTER TABLE "TaskBlock" DROP CONSTRAINT "TaskBlock_blockedId_fkey";

-- DropForeignKey
ALTER TABLE "TaskBlock" DROP CONSTRAINT "TaskBlock_blockerId_fkey";

-- DropForeignKey
ALTER TABLE "TaskCollaborator" DROP CONSTRAINT "TaskCollaborator_taskId_fkey";

-- DropForeignKey
ALTER TABLE "TaskCollaborator" DROP CONSTRAINT "TaskCollaborator_userId_fkey";

-- DropForeignKey
ALTER TABLE "TaskComment" DROP CONSTRAINT "TaskComment_taskId_fkey";

-- DropForeignKey
ALTER TABLE "TaskComment" DROP CONSTRAINT "TaskComment_userId_fkey";

-- DropForeignKey
ALTER TABLE "TaskCustomField" DROP CONSTRAINT "TaskCustomField_taskId_fkey";

-- DropForeignKey
ALTER TABLE "TaskCustomField" DROP CONSTRAINT "TaskCustomField_userId_fkey";

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "actualTime",
DROP COLUMN "aiContextId",
DROP COLUMN "aiSuggestions",
DROP COLUMN "aiSummary",
DROP COLUMN "archived",
DROP COLUMN "calendarEventId",
DROP COLUMN "description",
DROP COLUMN "energyLevel",
DROP COLUMN "estimatedTime",
DROP COLUMN "externalSyncId",
DROP COLUMN "integrationMeta",
DROP COLUMN "isPrivate",
DROP COLUMN "isTemplate",
DROP COLUMN "moodRequired",
DROP COLUMN "personId",
DROP COLUMN "placeId",
DROP COLUMN "requiredService",
DROP COLUMN "requiresApiKey",
DROP COLUMN "reward",
DROP COLUMN "score",
DROP COLUMN "status",
DROP COLUMN "syncStatus",
DROP COLUMN "type",
DROP COLUMN "userId",
ADD COLUMN     "assigneeId" TEXT,
ADD COLUMN     "completedById" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "number" INTEGER NOT NULL,
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "projectId" TEXT NOT NULL,
ADD COLUMN     "quantity" DECIMAL(12,3),
ADD COLUMN     "statusId" TEXT NOT NULL,
ADD COLUMN     "title" TEXT NOT NULL,
ADD COLUMN     "unit" TEXT;

-- AlterTable
ALTER TABLE "TaskChecklistItem" ALTER COLUMN "order" SET NOT NULL,
ALTER COLUMN "order" SET DEFAULT 0;

-- DropTable
DROP TABLE "Achievement";

-- DropTable
DROP TABLE "Attachment";

-- DropTable
DROP TABLE "TaskActivity";

-- DropTable
DROP TABLE "TaskCollaborator";

-- DropTable
DROP TABLE "TaskComment";

-- DropTable
DROP TABLE "TaskCustomField";

-- DropEnum
DROP TYPE "CollaboratorRole";

-- DropEnum
DROP TYPE "FileType";

-- DropEnum
DROP TYPE "TaskStatus";

-- DropEnum
DROP TYPE "TaskType";

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "ProjectType" NOT NULL DEFAULT 'GENERAL',
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNED',
    "key" TEXT NOT NULL,
    "taskCounter" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "color" TEXT,
    "icon" TEXT,
    "isInbox" BOOLEAN NOT NULL DEFAULT false,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "viewersCanCheck" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTaskStatus" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "category" "StatusCategory" NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "ProjectTaskStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProjectRole" NOT NULL,
    "invitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("projectId","userId")
);

-- CreateIndex
CREATE INDEX "Project_ownerId_archivedAt_idx" ON "Project"("ownerId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Project_ownerId_key_key" ON "Project"("ownerId", "key");

-- CreateIndex
CREATE INDEX "ProjectTaskStatus_projectId_order_idx" ON "ProjectTaskStatus"("projectId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTaskStatus_projectId_name_key" ON "ProjectTaskStatus"("projectId", "name");

-- CreateIndex
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

-- CreateIndex
CREATE INDEX "Task_projectId_statusId_order_idx" ON "Task"("projectId", "statusId", "order");

-- CreateIndex
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");

-- CreateIndex
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Task_projectId_number_key" ON "Task"("projectId", "number");

-- CreateIndex
CREATE INDEX "TaskChecklistItem_taskId_order_idx" ON "TaskChecklistItem"("taskId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "TaskTag_taskId_tagId_key" ON "TaskTag"("taskId", "tagId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "ProjectTaskStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBlock" ADD CONSTRAINT "TaskBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskBlock" ADD CONSTRAINT "TaskBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTaskStatus" ADD CONSTRAINT "ProjectTaskStatus_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

