-- Gear photos get their own image scope so they stop showing up in the
-- personal gallery. Split from the backfill: Postgres cannot use a new enum
-- value in the same transaction that added it.

ALTER TYPE "ImageScope" ADD VALUE 'GEAR';
