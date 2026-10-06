-- Cancel requested, the agent not yet stopped. A separate migration from the
-- index below: a value added to an enum cannot be used in the transaction
-- that adds it.
ALTER TYPE "ReleaseStatus" ADD VALUE 'CANCELLING';
