-- Photo entry redesign — phase 1 (docs/photo-entry-redesign.md §9).
--
-- Hand-written on purpose. The generated version would cast PhotoEntryStatus
-- destructively; here the backfill runs BEFORE the enum is narrowed, so the old
-- SELECTED / EDITING / COMPLETED values can be mapped onto the new postStage
-- axis first. The mapping is a bijection — nothing is lost.

-- ---------------------------------------------------------------------------
-- 1. New enums
-- ---------------------------------------------------------------------------

CREATE TYPE "PhotoEntryPostStage" AS ENUM ('NONE', 'SELECTING', 'EDITING', 'FINISHED');
CREATE TYPE "PhotoEntryCommentKind" AS ENUM ('NOTE', 'TODO', 'HIGHLIGHT', 'PROBLEM');
CREATE TYPE "GearOwnership" AS ENUM ('OWNED', 'WISHLIST', 'RETIRED');

-- ---------------------------------------------------------------------------
-- 2. Extend GearCategory — additive only, so no data migration
-- ---------------------------------------------------------------------------

ALTER TYPE "GearCategory" ADD VALUE 'FILM_CAMERA';
ALTER TYPE "GearCategory" ADD VALUE 'TELECONVERTER';
ALTER TYPE "GearCategory" ADD VALUE 'ADAPTER';
ALTER TYPE "GearCategory" ADD VALUE 'FILTER';
ALTER TYPE "GearCategory" ADD VALUE 'TELESCOPE';
ALTER TYPE "GearCategory" ADD VALUE 'SMART_TELESCOPE';
ALTER TYPE "GearCategory" ADD VALUE 'MOUNT';
ALTER TYPE "GearCategory" ADD VALUE 'HEAD';
ALTER TYPE "GearCategory" ADD VALUE 'GIMBAL';
ALTER TYPE "GearCategory" ADD VALUE 'FLASH';
ALTER TYPE "GearCategory" ADD VALUE 'LIGHT_MODIFIER';
ALTER TYPE "GearCategory" ADD VALUE 'BATTERY';
ALTER TYPE "GearCategory" ADD VALUE 'CHARGER';
ALTER TYPE "GearCategory" ADD VALUE 'POWER_BANK';
ALTER TYPE "GearCategory" ADD VALUE 'DRONE';
ALTER TYPE "GearCategory" ADD VALUE 'ACTION_CAM';
ALTER TYPE "GearCategory" ADD VALUE 'REMOTE';
ALTER TYPE "GearCategory" ADD VALUE 'MEMORY_CARD';
ALTER TYPE "GearCategory" ADD VALUE 'CARD_READER';
ALTER TYPE "GearCategory" ADD VALUE 'STORAGE';
ALTER TYPE "GearCategory" ADD VALUE 'COMPUTER';
ALTER TYPE "GearCategory" ADD VALUE 'STRAP';
ALTER TYPE "GearCategory" ADD VALUE 'RAIN_COVER';
ALTER TYPE "GearCategory" ADD VALUE 'CLEANING';
ALTER TYPE "GearCategory" ADD VALUE 'CABLE';
ALTER TYPE "GearCategory" ADD VALUE 'ASTRO_CAMERA';
ALTER TYPE "GearCategory" ADD VALUE 'GUIDE_SCOPE';
ALTER TYPE "GearCategory" ADD VALUE 'EYEPIECE';
ALTER TYPE "GearCategory" ADD VALUE 'BINOCULARS';
ALTER TYPE "GearCategory" ADD VALUE 'DIAGONAL';
ALTER TYPE "GearCategory" ADD VALUE 'DEW_HEATER';
ALTER TYPE "GearCategory" ADD VALUE 'POWER_STATION';

-- ---------------------------------------------------------------------------
-- 3. PhotoEntry — new columns
-- ---------------------------------------------------------------------------

ALTER TABLE "PhotoEntry"
    ADD COLUMN "postStage"       "PhotoEntryPostStage" NOT NULL DEFAULT 'NONE',
    ADD COLUMN "firstEditedAt"   TIMESTAMP(3),
    ADD COLUMN "gearConfirmedAt" TIMESTAMP(3),
    ADD COLUMN "photoCount"      INTEGER,
    ADD COLUMN "selectedCount"   INTEGER,
    ADD COLUMN "editedCount"     INTEGER;

-- ---------------------------------------------------------------------------
-- 4. BACKFILL — must run while the old status values still exist
-- ---------------------------------------------------------------------------

-- The post-processing axis, extracted from the old single enum.
UPDATE "PhotoEntry"
SET "postStage" = (
    CASE "status"::text
        WHEN 'SELECTED'  THEN 'SELECTING'
        WHEN 'EDITING'   THEN 'EDITING'
        WHEN 'COMPLETED' THEN 'FINISHED'
        ELSE 'NONE'
    END
)::"PhotoEntryPostStage";

-- "Was edited" has to survive a later revert to NONE, so stamp it now. updatedAt
-- is the closest thing to a first-edit date that the old model recorded.
UPDATE "PhotoEntry"
SET "firstEditedAt" = "updatedAt"
WHERE "status"::text IN ('SELECTED', 'EDITING', 'COMPLETED');

-- Entries already marked uploaded count as "gear declared, nothing to secure", so
-- they do not start nagging for a gear list. NOT_UPLOADED keeps a NULL, which is
-- what puts an entry in the queue to be filled in.
UPDATE "PhotoEntry"
SET "gearConfirmedAt" = "updatedAt"
WHERE "uploadStatus" = 'UPLOADED';

-- ---------------------------------------------------------------------------
-- 5. Narrow PhotoEntryStatus to PLANNED / SHOT / CANCELLED
--
-- Everything that is not PLANNED happened, so it becomes SHOT; the detail that
-- used to live here now lives in postStage, backfilled above.
-- ---------------------------------------------------------------------------

ALTER TYPE "PhotoEntryStatus" RENAME TO "PhotoEntryStatus_old";
CREATE TYPE "PhotoEntryStatus" AS ENUM ('PLANNED', 'SHOT', 'CANCELLED');

ALTER TABLE "PhotoEntry" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "PhotoEntry"
    ALTER COLUMN "status" TYPE "PhotoEntryStatus"
    USING (
        CASE "status"::text
            WHEN 'PLANNED' THEN 'PLANNED'
            ELSE 'SHOT'
        END
    )::"PhotoEntryStatus";

ALTER TABLE "PhotoEntry" ALTER COLUMN "status" SET DEFAULT 'PLANNED';

DROP TYPE "PhotoEntryStatus_old";

-- ---------------------------------------------------------------------------
-- 6. GearItem — ownership and wishlist details
-- ---------------------------------------------------------------------------

ALTER TABLE "GearItem"
    ADD COLUMN "ownership"      "GearOwnership" NOT NULL DEFAULT 'OWNED',
    ADD COLUMN "acquiredAt"     TIMESTAMP(3),
    ADD COLUMN "retiredAt"      TIMESTAMP(3),
    ADD COLUMN "priority"       INTEGER,
    ADD COLUMN "estimatedPrice" INTEGER,
    ADD COLUMN "purchaseUrl"    TEXT;

CREATE INDEX "GearItem_ownership_idx" ON "GearItem"("ownership");

-- ---------------------------------------------------------------------------
-- 7. New tables
-- ---------------------------------------------------------------------------

CREATE TABLE "PhotoEntryGear" (
    "id"           TEXT NOT NULL,
    "photoEntryId" TEXT NOT NULL,
    "gearItemId"   TEXT NOT NULL,
    "packed"       BOOLEAN NOT NULL DEFAULT false,
    "used"         BOOLEAN NOT NULL DEFAULT false,
    "secured"      BOOLEAN NOT NULL DEFAULT false,
    "securedAt"    TIMESTAMP(3),
    "note"         TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhotoEntryGear_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PhotoEntryGear_photoEntryId_gearItemId_key"
    ON "PhotoEntryGear"("photoEntryId", "gearItemId");
CREATE INDEX "PhotoEntryGear_gearItemId_idx" ON "PhotoEntryGear"("gearItemId");

CREATE TABLE "PhotoEntryComment" (
    "id"           TEXT NOT NULL,
    "photoEntryId" TEXT NOT NULL,
    "kind"         "PhotoEntryCommentKind" NOT NULL DEFAULT 'NOTE',
    "body"         TEXT NOT NULL,
    "atStatus"     "PhotoEntryStatus" NOT NULL,
    "atPostStage"  "PhotoEntryPostStage" NOT NULL,
    "resolvedAt"   TIMESTAMP(3),
    "authorId"     TEXT NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhotoEntryComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PhotoEntryComment_photoEntryId_atPostStage_idx"
    ON "PhotoEntryComment"("photoEntryId", "atPostStage");
CREATE INDEX "PhotoEntryComment_photoEntryId_resolvedAt_idx"
    ON "PhotoEntryComment"("photoEntryId", "resolvedAt");

CREATE TABLE "GearKit" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GearKit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GearKit_name_key" ON "GearKit"("name");

CREATE TABLE "GearKitItem" (
    "id"         TEXT NOT NULL,
    "kitId"      TEXT NOT NULL,
    "gearItemId" TEXT NOT NULL,

    CONSTRAINT "GearKitItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GearKitItem_kitId_gearItemId_key"
    ON "GearKitItem"("kitId", "gearItemId");
CREATE INDEX "GearKitItem_gearItemId_idx" ON "GearKitItem"("gearItemId");

-- ---------------------------------------------------------------------------
-- 8. Foreign keys
--
-- PhotoEntryGear -> GearItem is RESTRICT: deleting gear must not erase the
-- record of what a photo was taken with. Gear is retired, not deleted.
-- ---------------------------------------------------------------------------

ALTER TABLE "PhotoEntryGear"
    ADD CONSTRAINT "PhotoEntryGear_photoEntryId_fkey"
    FOREIGN KEY ("photoEntryId") REFERENCES "PhotoEntry"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PhotoEntryGear"
    ADD CONSTRAINT "PhotoEntryGear_gearItemId_fkey"
    FOREIGN KEY ("gearItemId") REFERENCES "GearItem"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PhotoEntryComment"
    ADD CONSTRAINT "PhotoEntryComment_photoEntryId_fkey"
    FOREIGN KEY ("photoEntryId") REFERENCES "PhotoEntry"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PhotoEntryComment"
    ADD CONSTRAINT "PhotoEntryComment_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GearKitItem"
    ADD CONSTRAINT "GearKitItem_kitId_fkey"
    FOREIGN KEY ("kitId") REFERENCES "GearKit"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GearKitItem"
    ADD CONSTRAINT "GearKitItem_gearItemId_fkey"
    FOREIGN KEY ("gearItemId") REFERENCES "GearItem"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
