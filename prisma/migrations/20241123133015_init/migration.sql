-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'MODERATOR', 'ADMIN', 'OWNER');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('CREATED', 'EMAIL_VERIFICATION', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "SocialMediaType" AS ENUM ('FACEBOOK', 'INSTAGRAM', 'TWITTER', 'TIKTOK', 'LINKEDIN', 'GITHUB');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('IMAGE');

-- CreateEnum
CREATE TYPE "ServerProcessStatus" AS ENUM ('UNKNOWN', 'STARTED', 'ONGOING', 'CLOSED', 'ENDED', 'FAILED');

-- CreateEnum
CREATE TYPE "ServerStatus" AS ENUM ('UNKNOWN', 'OFFLINE', 'ONLINE', 'ERROR', 'MAINTENANCE', 'WAKE_IN_PROGRESS', 'SHUTDOWN_IN_PROGRESS');

-- CreateEnum
CREATE TYPE "CommandType" AS ENUM ('MESSAGE', 'EVENT');

-- CreateEnum
CREATE TYPE "CommandStatus" AS ENUM ('ENABLED', 'DISABLED', 'RUNNING');

-- CreateEnum
CREATE TYPE "ProcessLogLevel" AS ENUM ('LOG', 'SUCCESS', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "SettingType" AS ENUM ('STRING', 'NUMBER');

-- CreateEnum
CREATE TYPE "DiskType" AS ENUM ('HDD', 'SSD', 'NVME');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "email" TEXT NOT NULL,
    "hashPassword" TEXT,
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "avatarId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialMedia" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "type" "SocialMediaType" NOT NULL,
    "authorId" TEXT NOT NULL,

    CONSTRAINT "SocialMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "platform" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "refreshToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageData" (
    "id" TEXT NOT NULL,
    "localization" TEXT NOT NULL,
    "dateTaken" TIMESTAMP(3) NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "authorId" TEXT,
    "imageId" TEXT NOT NULL,

    CONSTRAINT "ImageData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "coverUrl" TEXT NOT NULL,
    "lowResUrl" TEXT NOT NULL,
    "dimensionsId" TEXT,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dimensions" (
    "id" TEXT NOT NULL,
    "width" TEXT NOT NULL,
    "height" TEXT NOT NULL,

    CONSTRAINT "Dimensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Server" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Server_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerCategory" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "name" TEXT,
    "value" TEXT NOT NULL,

    CONSTRAINT "ServerCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerCommand" (
    "id" TEXT NOT NULL,
    "serverCategoryId" TEXT NOT NULL,
    "name" TEXT,
    "value" TEXT NOT NULL,
    "status" "CommandStatus" NOT NULL DEFAULT 'DISABLED',
    "runningProgress" INTEGER,
    "type" "CommandType" NOT NULL,

    CONSTRAINT "ServerCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerSettings" (
    "id" TEXT NOT NULL,
    "serverCategoryId" TEXT NOT NULL,
    "name" TEXT,
    "serverName" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" "SettingType" NOT NULL,

    CONSTRAINT "ServerSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerProperties" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "status" "ServerStatus",
    "startedById" TEXT,
    "uptime" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cPUInfoId" TEXT,
    "memoryInfoId" TEXT,

    CONSTRAINT "ServerProperties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CPUInfo" (
    "id" TEXT NOT NULL,
    "cores" INTEGER,
    "physicalCores" INTEGER,
    "currentLoad" DOUBLE PRECISION,
    "currentLoadUser" DOUBLE PRECISION,
    "currentLoadSystem" DOUBLE PRECISION,
    "serverPropertiesId" TEXT NOT NULL,

    CONSTRAINT "CPUInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryInfo" (
    "id" TEXT NOT NULL,
    "total" BIGINT,
    "free" BIGINT,
    "serverPropertiesId" TEXT NOT NULL,

    CONSTRAINT "MemoryInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiskInfo" (
    "id" TEXT NOT NULL,
    "fs" TEXT,
    "type" TEXT,
    "used" BIGINT,
    "available" BIGINT,
    "name" TEXT,
    "mediaType" "DiskType",
    "serverPropertiesId" TEXT NOT NULL,

    CONSTRAINT "DiskInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Process" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stoppedAt" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "startedById" TEXT NOT NULL,
    "categoryId" TEXT,
    "status" "ServerProcessStatus" NOT NULL,

    CONSTRAINT "Process_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessLog" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" "ProcessLogLevel" DEFAULT 'LOG',
    "processId" TEXT NOT NULL,

    CONSTRAINT "ProcessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_avatarId_key" ON "User"("avatarId");

-- CreateIndex
CREATE UNIQUE INDEX "ImageData_imageId_key" ON "ImageData"("imageId");

-- CreateIndex
CREATE UNIQUE INDEX "Image_dimensionsId_key" ON "Image"("dimensionsId");

-- CreateIndex
CREATE UNIQUE INDEX "Server_name_key" ON "Server"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ServerProperties_serverId_key" ON "ServerProperties"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "CPUInfo_serverPropertiesId_key" ON "CPUInfo"("serverPropertiesId");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryInfo_serverPropertiesId_key" ON "MemoryInfo"("serverPropertiesId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialMedia" ADD CONSTRAINT "SocialMedia_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageData" ADD CONSTRAINT "ImageData_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageData" ADD CONSTRAINT "ImageData_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageData" ADD CONSTRAINT "ImageData_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_dimensionsId_fkey" FOREIGN KEY ("dimensionsId") REFERENCES "Dimensions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerCategory" ADD CONSTRAINT "ServerCategory_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerCommand" ADD CONSTRAINT "ServerCommand_serverCategoryId_fkey" FOREIGN KEY ("serverCategoryId") REFERENCES "ServerCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerSettings" ADD CONSTRAINT "ServerSettings_serverCategoryId_fkey" FOREIGN KEY ("serverCategoryId") REFERENCES "ServerCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerProperties" ADD CONSTRAINT "ServerProperties_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerProperties" ADD CONSTRAINT "ServerProperties_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CPUInfo" ADD CONSTRAINT "CPUInfo_serverPropertiesId_fkey" FOREIGN KEY ("serverPropertiesId") REFERENCES "ServerProperties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryInfo" ADD CONSTRAINT "MemoryInfo_serverPropertiesId_fkey" FOREIGN KEY ("serverPropertiesId") REFERENCES "ServerProperties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiskInfo" ADD CONSTRAINT "DiskInfo_serverPropertiesId_fkey" FOREIGN KEY ("serverPropertiesId") REFERENCES "ServerProperties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServerCategory"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessLog" ADD CONSTRAINT "ProcessLog_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE CASCADE ON UPDATE CASCADE;
