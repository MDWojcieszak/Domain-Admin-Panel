import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { IntegrationPlatform } from '@prisma/client';

import { GetCurrentUser, Throttle } from '../common/decorators';
import { SessionOnlyGuard, ThrottleGuard } from '../common/guards';
import { DeviceAuthorizationService } from './device-authorization.service';
import { IntegrationTokenService } from './integration-token.service';
import { CreateIntegrationTokenDto } from './dto';
import {
  DeviceApprovalRequestResponse,
  DeviceApprovalResultResponse,
  IntegrationTokenCreatedResponse,
  IntegrationTokenListResponse,
  IntegrationTokenResponse,
} from './responses';

/**
 * Account-side integrations: the approval screen for a pending device, and the
 * list of tokens issued to external apps.
 *
 * These are self-service — a token can never grant more than its owner already
 * has, so issuing one is not a privilege escalation and needs no extra
 * permission beyond being signed in (same reasoning as `/session/my`).
 * SessionOnlyGuard is what keeps that true: an integration token must not be
 * able to mint another one.
 */
@ApiTags('Integrations')
@ApiBearerAuth()
@Controller('integrations')
@UseGuards(SessionOnlyGuard, ThrottleGuard)
export class IntegrationController {
  constructor(
    private readonly tokens: IntegrationTokenService,
    private readonly deviceAuth: DeviceAuthorizationService,
  ) {}

  @Get('device/:userCode')
  @ApiOperation({
    summary: 'What a pending device is asking for',
    description:
      'Renders the approval screen. Show `clientName`, `platform` and every ' +
      'entry of `scopes` — this is the only point where the user sees what ' +
      'they are about to grant.',
  })
  @ApiOkResponse({ type: DeviceApprovalRequestResponse })
  getPendingDevice(
    @Param('userCode') userCode: string,
  ): Promise<DeviceApprovalRequestResponse> {
    return this.deviceAuth.getPending(userCode);
  }

  // A user code is short by design, so guessing one is the obvious attack.
  // Ten tries a minute makes that pointless well inside the 10-minute window.
  @Throttle(10, 60_000)
  @Post('device/:userCode/approve')
  @ApiOperation({ summary: 'Grant the pending device its token' })
  @ApiOkResponse({ type: DeviceApprovalResultResponse })
  approveDevice(
    @GetCurrentUser('sub') userId: string,
    @Param('userCode') userCode: string,
  ): Promise<DeviceApprovalResultResponse> {
    return this.deviceAuth.approve(userId, userCode);
  }

  @Throttle(10, 60_000)
  @Post('device/:userCode/deny')
  @ApiOperation({ summary: 'Refuse the pending device' })
  @ApiOkResponse({ type: DeviceApprovalResultResponse })
  denyDevice(
    @GetCurrentUser('sub') userId: string,
    @Param('userCode') userCode: string,
  ): Promise<DeviceApprovalResultResponse> {
    return this.deviceAuth.deny(userId, userCode);
  }

  @Get('tokens')
  @ApiOperation({
    summary: 'Integrations connected to this account',
    description:
      'Metadata only — token values are never retrievable after creation.',
  })
  @ApiOkResponse({ type: IntegrationTokenListResponse })
  async listTokens(
    @GetCurrentUser('sub') userId: string,
  ): Promise<IntegrationTokenListResponse> {
    const tokens = await this.tokens.list(userId);
    return { tokens, total: tokens.length };
  }

  @Post('tokens')
  @ApiOperation({
    summary: 'Create a token manually (copy-paste path)',
    description:
      'The fallback to the device flow, for scripts and CLI tools. The value ' +
      'is returned once and never again — surface a copy button here.',
  })
  @ApiOkResponse({ type: IntegrationTokenCreatedResponse })
  async createToken(
    @GetCurrentUser('sub') userId: string,
    @Body() dto: CreateIntegrationTokenDto,
  ): Promise<IntegrationTokenCreatedResponse> {
    const issued = await this.tokens.issue({
      userId,
      name: dto.name,
      platform: dto.platform ?? IntegrationPlatform.OTHER,
      scopes: dto.scopes,
      expiresAt: resolveExpiry(dto),
    });

    return {
      id: issued.id,
      token: issued.value,
      scopes: dto.scopes,
      expiresAt: issued.expiresAt,
    };
  }

  @Delete('tokens/:id')
  @ApiOperation({
    summary: 'Revoke an integration',
    description:
      'Takes effect on the next request the app makes. Idempotent — revoking ' +
      'an already-revoked token is not an error.',
  })
  @ApiOkResponse({ type: IntegrationTokenResponse })
  revokeToken(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<IntegrationTokenResponse> {
    return this.tokens.revoke(userId, id);
  }
}

/** `undefined` = service default (one year), `null` = never expires. */
function resolveExpiry(
  dto: CreateIntegrationTokenDto,
): Date | null | undefined {
  if (dto.expires === false) return null;
  if (dto.expiresAt) return new Date(dto.expiresAt);
  return undefined;
}
