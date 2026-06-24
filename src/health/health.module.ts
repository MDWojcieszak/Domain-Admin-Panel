import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';

/** Liveness/readiness probes for orchestration + load balancers. */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
