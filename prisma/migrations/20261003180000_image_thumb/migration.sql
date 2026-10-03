-- Mid-size derived image (~640 px) for tiles; the 80 px low-res is a blur placeholder.
-- Existing images get it on the next POST /image/reprocess (mode missing).

-- AlterTable
ALTER TABLE "Image" ADD COLUMN     "thumbUrl" TEXT;

