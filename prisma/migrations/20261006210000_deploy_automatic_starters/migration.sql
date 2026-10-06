-- A process started by a webhook, a schedule, an automatic update or an
-- automatic rollback has no user behind it. With the column required, every
-- such deployment failed with a 500 before it reached the agent.
ALTER TABLE "Process" ALTER COLUMN "startedById" DROP NOT NULL;

-- What started it instead, in words: "webhook · GitHub Actions · alice ·
-- abc1234", "automatic update". Null when a user did.
ALTER TABLE "Process" ADD COLUMN "startedByLabel" TEXT;
ALTER TABLE "Release" ADD COLUMN "triggeredByLabel" TEXT;
