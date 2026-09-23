-- CreateEnum
CREATE TYPE "ApplicationTier" AS ENUM ('BOOTSTRAP', 'INFRASTRUCTURE', 'APPLICATION');

-- CreateEnum
CREATE TYPE "AppSourceType" AS ENUM ('RENDERED', 'GIT', 'HOST');

-- CreateEnum
CREATE TYPE "ContainerOrigin" AS ENUM ('MANAGED', 'ADOPTABLE', 'TRUENAS', 'STANDALONE');

-- CreateEnum
CREATE TYPE "ReleaseStatus" AS ENUM ('PENDING', 'DEPLOYING', 'ACTIVE', 'FAILED', 'SUPERSEDED', 'ROLLED_BACK', 'DEFERRED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ReleaseTrigger" AS ENUM ('MANUAL', 'WEBHOOK', 'SCHEDULE', 'AUTO_UPDATE', 'ROLLBACK', 'AUTO_ROLLBACK');

-- CreateEnum
CREATE TYPE "AuditSource" AS ENUM ('PANEL', 'WEBHOOK', 'SCHEDULE', 'SYSTEM');

-- CreateTable
CREATE TABLE "GitAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'github.com',
    "username" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GitRepo" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "branch" TEXT NOT NULL DEFAULT 'main',
    "clonePath" TEXT,
    "accountId" TEXT,
    "lastCommit" TEXT,
    "lastFetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitRepo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT,
    "description" TEXT,
    "tier" "ApplicationTier" NOT NULL DEFAULT 'APPLICATION',
    "sourceType" "AppSourceType" NOT NULL DEFAULT 'RENDERED',
    "origin" "ContainerOrigin" NOT NULL DEFAULT 'MANAGED',
    "image" TEXT,
    "gitRepoId" TEXT,
    "spec" JSONB NOT NULL,
    "runtimeStatus" "CommandRuntimeStatus" NOT NULL DEFAULT 'IDLE',
    "runtimeSince" TIMESTAMP(3),
    "runtimeMessage" TEXT,
    "availableDigest" TEXT,
    "lastPolledAt" TIMESTAMP(3),
    "webhookSecret" TEXT,
    "webhookEnabled" BOOLEAN NOT NULL DEFAULT false,
    "serverCategoryId" TEXT NOT NULL,
    "currentReleaseId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Release" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "version" TEXT,
    "digest" TEXT,
    "commit" TEXT,
    "status" "ReleaseStatus" NOT NULL DEFAULT 'PENDING',
    "processId" TEXT,
    "renderedCompose" TEXT,
    "renderedEnvKeys" TEXT[],
    "homelabCommit" TEXT,
    "previousReleaseId" TEXT,
    "triggeredById" TEXT,
    "trigger" "ReleaseTrigger" NOT NULL DEFAULT 'MANUAL',
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deployedAt" TIMESTAMP(3),

    CONSTRAINT "Release_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Variable" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Variable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationEnv" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationEnv_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "source" "AuditSource" NOT NULL DEFAULT 'PANEL',
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityName" TEXT,
    "diff" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GitAccount_name_key" ON "GitAccount"("name");

-- CreateIndex
CREATE UNIQUE INDEX "GitRepo_name_key" ON "GitRepo"("name");

-- CreateIndex
CREATE INDEX "GitRepo_accountId_idx" ON "GitRepo"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_slug_key" ON "Application"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Application_serverCategoryId_key" ON "Application"("serverCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_currentReleaseId_key" ON "Application"("currentReleaseId");

-- CreateIndex
CREATE INDEX "Application_tier_isDeleted_idx" ON "Application"("tier", "isDeleted");

-- CreateIndex
CREATE INDEX "Application_gitRepoId_idx" ON "Application"("gitRepoId");

-- CreateIndex
CREATE UNIQUE INDEX "Release_processId_key" ON "Release"("processId");

-- CreateIndex
CREATE INDEX "Release_applicationId_status_idx" ON "Release"("applicationId", "status");

-- CreateIndex
CREATE INDEX "Release_applicationId_createdAt_idx" ON "Release"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "Release_triggeredById_idx" ON "Release"("triggeredById");

-- CreateIndex
CREATE UNIQUE INDEX "Variable_key_key" ON "Variable"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationEnv_applicationId_key_key" ON "ApplicationEnv"("applicationId", "key");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "GitRepo" ADD CONSTRAINT "GitRepo_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "GitAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_gitRepoId_fkey" FOREIGN KEY ("gitRepoId") REFERENCES "GitRepo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_serverCategoryId_fkey" FOREIGN KEY ("serverCategoryId") REFERENCES "ServerCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_currentReleaseId_fkey" FOREIGN KEY ("currentReleaseId") REFERENCES "Release"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Release" ADD CONSTRAINT "Release_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Release" ADD CONSTRAINT "Release_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Release" ADD CONSTRAINT "Release_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEnv" ADD CONSTRAINT "ApplicationEnv_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Invariant I13: at most one in-flight Release per application. Expressed as a
-- partial unique index because Prisma's schema language cannot describe one;
-- keep it here so a concurrent panel click, webhook and auto-update cannot start
-- three deployments of the same stack.
CREATE UNIQUE INDEX "Release_one_in_flight_per_application"
    ON "Release" ("applicationId")
    WHERE "status" IN ('PENDING', 'DEPLOYING');
