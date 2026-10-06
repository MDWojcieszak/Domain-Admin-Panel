-- A release being cancelled still holds the application. The agent may be
-- killing a compose step, waiting out a health gate or not have received the
-- cancel yet; a second deployment of the same stack must not start beside it.
DROP INDEX "Release_one_in_flight_per_application";

CREATE UNIQUE INDEX "Release_one_in_flight_per_application"
    ON "Release" ("applicationId")
    WHERE "status" IN ('PENDING', 'DEPLOYING', 'CANCELLING');
