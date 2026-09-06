-- Integration tokens for external apps (desktop) + RFC 8628 device grant.
-- Purely additive; idempotent so it is safe on fresh & existing DBs.

-- ---------- Enums ----------
DO $$ BEGIN
    CREATE TYPE "IntegrationPlatform" AS ENUM ('WINDOWS', 'MACOS', 'LINUX', 'IOS', 'ANDROID', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "DeviceAuthorizationStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- IntegrationToken ----------
CREATE TABLE IF NOT EXISTS "IntegrationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "lastFour" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" "IntegrationPlatform" NOT NULL DEFAULT 'OTHER',
    "scopes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "lastUsedIp" TEXT,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "IntegrationToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationToken_tokenId_key" ON "IntegrationToken"("tokenId");
CREATE INDEX IF NOT EXISTS "IntegrationToken_userId_idx" ON "IntegrationToken"("userId");

-- ---------- DeviceAuthorization ----------
CREATE TABLE IF NOT EXISTS "DeviceAuthorization" (
    "id" TEXT NOT NULL,
    "userCode" TEXT NOT NULL,
    "deviceCodeHash" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "platform" "IntegrationPlatform" NOT NULL DEFAULT 'OTHER',
    "scopes" TEXT[],
    "status" "DeviceAuthorizationStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "issuedTokenId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastPolledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceAuthorization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DeviceAuthorization_userCode_key" ON "DeviceAuthorization"("userCode");
CREATE UNIQUE INDEX IF NOT EXISTS "DeviceAuthorization_deviceCodeHash_key" ON "DeviceAuthorization"("deviceCodeHash");
CREATE INDEX IF NOT EXISTS "DeviceAuthorization_expiresAt_idx" ON "DeviceAuthorization"("expiresAt");
CREATE INDEX IF NOT EXISTS "DeviceAuthorization_approvedById_idx" ON "DeviceAuthorization"("approvedById");

-- ---------- Foreign keys ----------
DO $$ BEGIN
    ALTER TABLE "IntegrationToken" ADD CONSTRAINT "IntegrationToken_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "DeviceAuthorization" ADD CONSTRAINT "DeviceAuthorization_approvedById_fkey"
        FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "DeviceAuthorization" ADD CONSTRAINT "DeviceAuthorization_issuedTokenId_fkey"
        FOREIGN KEY ("issuedTokenId") REFERENCES "IntegrationToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
