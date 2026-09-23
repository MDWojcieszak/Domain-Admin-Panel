import { Body, Controller, Headers, Param, Post } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators';
import { DeployWebhookDto } from '../dto';
import { DeployWebhookService } from './deploy-webhook.service';

/** Header the CI pipeline puts its per-application secret in. */
export const WEBHOOK_SECRET_HEADER = 'x-deploy-secret';

/**
 * CI entry point, on its own controller because it is the only part of the
 * deploy module that is not authenticated as a user (§15).
 */
@ApiTags('Deploy')
@Controller('deploy/webhook')
export class DeployWebhookController {
  constructor(private readonly webhooks: DeployWebhookService) {}

  /**
   * Starts a deployment from CI.
   *
   * `@Public()` only means "no user session" — the per-application secret in
   * the header is still required, and every failure mode returns the same 401
   * so the endpoint cannot be used to enumerate applications.
   */
  @Public()
  @ApiExcludeEndpoint()
  @Post(':slug')
  handle(
    @Param('slug') slug: string,
    @Headers(WEBHOOK_SECRET_HEADER) secret: string | undefined,
    @Body() dto: DeployWebhookDto,
  ) {
    return this.webhooks.handle(slug, secret, dto);
  }
}
