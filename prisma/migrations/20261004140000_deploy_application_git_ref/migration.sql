-- Each application follows its own branch or tag of a repository.
ALTER TABLE "Application" ADD COLUMN "gitRef" TEXT;
