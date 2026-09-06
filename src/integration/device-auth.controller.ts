import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public, Throttle } from '../common/decorators';
import { ThrottleGuard } from '../common/guards';
import { DeviceAuthorizationService } from './device-authorization.service';
import { DeviceAuthorizeDto, DeviceTokenDto } from './dto';
import { DeviceAuthorizationResponse, DeviceTokenResponse } from './responses';

/**
 * Device half of the OAuth 2.0 device authorization grant (RFC 8628) — the
 * endpoints the desktop app itself talks to. Both are unauthenticated by
 * definition: the app has no credentials yet, that is the whole point.
 *
 * The user-facing half (approve / deny) lives on IntegrationController, behind
 * a normal signed-in session.
 */
@ApiTags('Device Authorization')
@Controller('auth/device')
@UseGuards(ThrottleGuard)
export class DeviceAuthController {
  constructor(private readonly deviceAuth: DeviceAuthorizationService) {}

  @Public()
  // Anyone can open a handshake, so cap how many codes a single caller can
  // burn — each one occupies a user code from a deliberately small space.
  @Throttle(10, 60_000)
  @Post('authorize')
  @ApiOperation({
    summary: 'Start a device authorization',
    description:
      'Returns a device/user code pair. Open `verificationUriComplete` in the ' +
      "user's browser, then poll `/auth/device/token` with `deviceCode` every " +
      '`interval` seconds until it returns a token.',
  })
  @ApiOkResponse({ type: DeviceAuthorizationResponse })
  authorize(
    @Body() dto: DeviceAuthorizeDto,
  ): Promise<DeviceAuthorizationResponse> {
    return this.deviceAuth.authorize(dto);
  }

  @Public()
  @Throttle(120, 60_000)
  @Post('token')
  @ApiOperation({
    summary: 'Collect the token once the user approves',
    description:
      'Until approval this returns HTTP 400 with an RFC 8628 error code: ' +
      '`authorization_pending`, `slow_down`, `access_denied` or `expired_token`. ' +
      'On success the token is returned exactly once — a replayed device code ' +
      'gets `invalid_grant`.',
  })
  @ApiOkResponse({ type: DeviceTokenResponse })
  token(@Body() dto: DeviceTokenDto): Promise<DeviceTokenResponse> {
    return this.deviceAuth.poll(dto.deviceCode);
  }
}
