import { Module } from '@nestjs/common';

import { SystemController } from './system.controller';
import { SystemCheckService } from './system-check.service';

/**
 * System health + diagnostics. Public liveness/readiness probes for
 * orchestration, plus a permission-gated panel view of subsystem connectivity
 * (database, mail/SMTP, RabbitMQ).
 */
@Module({
  controllers: [SystemController],
  providers: [SystemCheckService],
})
export class SystemModule {}
