-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('IMAGE', 'PDF', 'MODEL_3D', 'CAD', 'ARCHIVE', 'TEXT', 'OTHER');

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "extension" TEXT,
    "sha256" TEXT NOT NULL,
    "hasPreview" BOOLEAN NOT NULL DEFAULT false,
    "width" INTEGER,
    "height" INTEGER,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentLink" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "projectId" TEXT,
    "taskId" TEXT,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Document_ownerId_createdAt_idx" ON "Document"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "Document_ownerId_sha256_idx" ON "Document"("ownerId", "sha256");

-- CreateIndex
CREATE INDEX "DocumentLink_projectId_idx" ON "DocumentLink"("projectId");

-- CreateIndex
CREATE INDEX "DocumentLink_taskId_idx" ON "DocumentLink"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentLink_documentId_projectId_key" ON "DocumentLink"("documentId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentLink_documentId_taskId_key" ON "DocumentLink"("documentId", "taskId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentLink" ADD CONSTRAINT "DocumentLink_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentLink" ADD CONSTRAINT "DocumentLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentLink" ADD CONSTRAINT "DocumentLink_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentLink" ADD CONSTRAINT "DocumentLink_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A pin has exactly one target (I6). Prisma cannot express this; it lives here.
ALTER TABLE "DocumentLink" ADD CONSTRAINT "DocumentLink_one_target" CHECK (num_nonnulls("projectId", "taskId") = 1);
