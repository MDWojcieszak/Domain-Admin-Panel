import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeviceAuthorizationStatus, IntegrationPlatform } from '@prisma/client';
import { createHash, randomBytes, randomInt } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { IntegrationTokenService } from './integration-token.service';

/** No 0/O/1/I/L — the code has to survive being read off a screen and retyped. */
const USER_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const USER_CODE_LENGTH = 8;
const USER_CODE_ATTEMPTS = 5;

const DEVICE_CODE_BYTES = 32;

/** RFC 8628 defaults: short-lived handshake, 5 s minimum between polls. */
const AUTHORIZATION_LIFETIME_MS = 10 * 60 * 1000;
const POLL_INTERVAL_SECONDS = 5;

@Injectable()
export class DeviceAuthorizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: IntegrationTokenService,
    private readonly config: ConfigService,
  ) {}

  /** Step 1 — the desktop app asks for a code pair. Unauthenticated. */
  async authorize(params: {
    clientName: string;
    platform: IntegrationPlatform;
    scopes: string[];
  }) {
    const scopes = this.tokens.assertValidScopes(params.scopes);

    const deviceCode = randomBytes(DEVICE_CODE_BYTES).toString('hex');
    const userCode = await this.generateUserCode();
    const expiresAt = new Date(Date.now() + AUTHORIZATION_LIFETIME_MS);

    await this.prisma.deviceAuthorization.create({
      data: {
        userCode,
        deviceCodeHash: this.hash(deviceCode),
        clientName: params.clientName,
        platform: params.platform,
        scopes,
        expiresAt,
      },
    });

    const verificationUri = `${this.baseUrl()}/activate`;

    return {
      deviceCode,
      userCode,
      verificationUri,
      // Pre-filled variant — the app opens this directly, so nobody has to
      // read the code off one screen and type it into another.
      verificationUriComplete: `${verificationUri}?code=${encodeURIComponent(userCode)}`,
      expiresIn: Math.floor(AUTHORIZATION_LIFETIME_MS / 1000),
      interval: POLL_INTERVAL_SECONDS,
    };
  }

  /**
   * Step 3 — the app polls with its device code. Errors follow RFC 8628 so an
   * off-the-shelf device-flow client understands them verbatim.
   */
  async poll(deviceCode: string) {
    const record = await this.prisma.deviceAuthorization.findUnique({
      where: { deviceCodeHash: this.hash(deviceCode) },
    });

    if (!record) {
      throw this.grantError('invalid_grant', 'Unknown device code');
    }

    const now = Date.now();

    if (record.expiresAt.getTime() <= now) {
      throw this.grantError(
        'expired_token',
        'This authorization expired — start again from the app',
      );
    }

    const polledTooSoon =
      record.lastPolledAt &&
      now - record.lastPolledAt.getTime() < POLL_INTERVAL_SECONDS * 1000;

    await this.prisma.deviceAuthorization.update({
      where: { id: record.id },
      data: { lastPolledAt: new Date(now) },
    });

    if (polledTooSoon) {
      throw this.grantError('slow_down', 'Polling faster than the interval');
    }

    if (record.status === DeviceAuthorizationStatus.DENIED) {
      throw this.grantError('access_denied', 'The request was denied');
    }

    if (record.status === DeviceAuthorizationStatus.PENDING) {
      throw this.grantError(
        'authorization_pending',
        'Waiting for the user to approve in the browser',
      );
    }

    if (record.issuedTokenId) {
      // Replayed device code. The token was already handed over once and the
      // raw value no longer exists anywhere, so there is nothing to return.
      throw this.grantError('invalid_grant', 'Token was already collected');
    }

    // Minted here, not at approval time, so the plaintext never rests in a row.
    const issued = await this.tokens.issue({
      userId: record.approvedById,
      name: record.clientName,
      platform: record.platform,
      scopes: record.scopes,
    });

    await this.prisma.deviceAuthorization.update({
      where: { id: record.id },
      data: { issuedTokenId: issued.id },
    });

    return {
      token: issued.value,
      expiresAt: issued.expiresAt,
      scopes: record.scopes,
    };
  }

  /** Step 2a — what the approval screen renders. Requires a logged-in user. */
  async getPending(userCode: string) {
    const record = await this.findPendingOrThrow(userCode);

    return {
      userCode: record.userCode,
      clientName: record.clientName,
      platform: record.platform,
      scopes: record.scopes,
      expiresAt: record.expiresAt,
    };
  }

  /** Step 2b — the user says yes. The app's next poll collects the token. */
  async approve(userId: string, userCode: string) {
    const record = await this.findPendingOrThrow(userCode);

    await this.prisma.deviceAuthorization.update({
      where: { id: record.id },
      data: {
        status: DeviceAuthorizationStatus.APPROVED,
        approvedById: userId,
      },
    });

    return {
      userCode: record.userCode,
      clientName: record.clientName,
      platform: record.platform,
      scopes: record.scopes,
      status: DeviceAuthorizationStatus.APPROVED,
    };
  }

  async deny(userId: string, userCode: string) {
    const record = await this.findPendingOrThrow(userCode);

    await this.prisma.deviceAuthorization.update({
      where: { id: record.id },
      data: {
        status: DeviceAuthorizationStatus.DENIED,
        approvedById: userId,
      },
    });

    return {
      userCode: record.userCode,
      clientName: record.clientName,
      platform: record.platform,
      scopes: record.scopes,
      status: DeviceAuthorizationStatus.DENIED,
    };
  }

  private async findPendingOrThrow(userCode: string) {
    const normalized = this.normalizeUserCode(userCode);

    const record = await this.prisma.deviceAuthorization.findUnique({
      where: { userCode: normalized },
    });

    if (!record) {
      throw new NotFoundException('Unknown or expired code');
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('This code has expired');
    }

    if (record.status !== DeviceAuthorizationStatus.PENDING) {
      throw new BadRequestException('This code has already been used');
    }

    return record;
  }

  /**
   * Accepts what a human would actually paste: lower case, missing dash, spaces.
   * Stored codes are always upper case `XXXX-XXXX`.
   */
  private normalizeUserCode(userCode: string): string {
    const bare = userCode
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, USER_CODE_LENGTH);

    return `${bare.slice(0, 4)}-${bare.slice(4)}`;
  }

  private async generateUserCode(): Promise<string> {
    for (let attempt = 0; attempt < USER_CODE_ATTEMPTS; attempt++) {
      // randomInt is rejection-sampled, so the alphabet stays uniform even
      // though 31 does not divide the random range evenly.
      const chars = Array.from(
        { length: USER_CODE_LENGTH },
        () => USER_CODE_ALPHABET[randomInt(USER_CODE_ALPHABET.length)],
      );
      const candidate = `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;

      const taken = await this.prisma.deviceAuthorization.findUnique({
        where: { userCode: candidate },
        select: { id: true },
      });

      if (!taken) return candidate;
    }

    throw new BadRequestException('Could not allocate a user code, try again');
  }

  private hash(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
  }

  private baseUrl(): string {
    return (
      this.config.get<string>('INTERFACE_URL')?.replace(/\/+$/, '') ??
      'http://localhost:3000'
    );
  }

  /** RFC 8628 §3.5 shape: HTTP 400 with an `error` code the client switches on. */
  private grantError(error: string, description: string): BadRequestException {
    return new BadRequestException({ error, error_description: description });
  }
}
