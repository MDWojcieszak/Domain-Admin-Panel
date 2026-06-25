import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { Public, RequirePermissions } from '../common/decorators';
import { PERMISSIONS } from '../common/acl/permissions';
import { PrismaService } from '../prisma/prisma.service';
import { SystemCheckService } from './system-check.service';
import { SystemStatusResponse } from './responses';

@ApiTags('System')
@Controller()
export class SystemController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly checks: SystemCheckService,
  ) {}

  /** Liveness — the process is up. Cheap, no dependencies touched. */
  @Public()
  @Get('health')
  @ApiOkResponse({ description: 'Process is alive' })
  liveness() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  /** Readiness — DB reachable. 503 when not ready (orchestration probe). */
  @Public()
  @Get('health/ready')
  @ApiOkResponse({ description: 'Dependencies reachable' })
  async readiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', db: 'up' };
    } catch {
      throw new ServiceUnavailableException({ status: 'error', db: 'down' });
    }
  }

  /** Panel diagnostics — per-subsystem status (DB, mail, RabbitMQ). */
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  @Get('system/status')
  @ApiOkResponse({
    description: 'System diagnostics (database, mail, RabbitMQ)',
    type: SystemStatusResponse,
  })
  status(): Promise<SystemStatusResponse> {
    return this.checks.checkAll();
  }
}
