-- A release an operator stopped before it finished. Outside the in-flight
-- index (PENDING, DEPLOYING), so cancelling frees the application at once.
ALTER TYPE "ReleaseStatus" ADD VALUE 'CANCELLED';
