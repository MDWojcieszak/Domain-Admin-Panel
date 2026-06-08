import {
  KeyObject,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
} from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlogAccessTier } from '@prisma/client';

export interface SignedLicense {
  license: string;
  expiresAt: Date;
}

export interface LicenseClaims {
  iss: string;
  sub: string;
  did: string;
  iid: string;
  tier: BlogAccessTier;
  iat: number;
  exp: number;
}

function b64url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function b64urlDecode(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

/**
 * Issues and verifies offline device licenses as compact EdDSA (Ed25519) JWS.
 * The PRIVATE key never leaves this service — only signLicense() uses it, and
 * only the public key is exposed (for the app to verify offline).
 */
@Injectable()
export class LicenseService {
  private readonly logger = new Logger(LicenseService.name);
  private readonly privateKey: KeyObject;
  private readonly publicKey: KeyObject;
  private readonly publicKeyPem: string;
  readonly ttlDays: number;

  constructor(config: ConfigService) {
    this.ttlDays = Math.max(
      1,
      Number(config.get('BLOG_LICENSE_TTL_DAYS')) || 30,
    );

    const privPem = config.get<string>('BLOG_LICENSE_PRIVATE_KEY');
    const pubPem = config.get<string>('BLOG_LICENSE_PUBLIC_KEY');

    if (privPem) {
      this.privateKey = createPrivateKey(privPem);
      this.publicKey = pubPem
        ? createPublicKey(pubPem)
        : createPublicKey(this.privateKey);
    } else {
      // DEV-ONLY: ephemeral keypair regenerated each startup (not persisted).
      const { privateKey, publicKey } = generateKeyPairSync('ed25519');
      this.privateKey = privateKey;
      this.publicKey = publicKey;
      this.logger.warn(
        'BLOG_LICENSE_PRIVATE_KEY not set — generated an EPHEMERAL Ed25519 ' +
          'keypair. Licenses will not survive restart. DO NOT use in production.',
      );
    }

    this.publicKeyPem = this.publicKey
      .export({ type: 'spki', format: 'pem' })
      .toString();
  }

  getPublicKeyPem(): string {
    return this.publicKeyPem;
  }

  signLicense(input: {
    userId: string;
    deviceId: string;
    installationId: string;
    tier: BlogAccessTier;
    expiresAt: Date;
  }): SignedLicense {
    const header = { alg: 'EdDSA', typ: 'JWT' };
    const payload: LicenseClaims = {
      iss: 'blog',
      sub: input.userId,
      did: input.deviceId,
      iid: input.installationId,
      tier: input.tier,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(input.expiresAt.getTime() / 1000),
    };

    const h = b64url(Buffer.from(JSON.stringify(header)));
    const p = b64url(Buffer.from(JSON.stringify(payload)));
    const signingInput = Buffer.from(`${h}.${p}`);
    const signature = sign(null, signingInput, this.privateKey); // null algo => Ed25519
    const license = `${h}.${p}.${b64url(signature)}`;

    return { license, expiresAt: input.expiresAt };
  }

  /** Verifies a license (diagnostics/tests). The app verifies offline itself. */
  verify(token: string): LicenseClaims {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Malformed license');
    }
    const [h, p, s] = parts;
    const signingInput = Buffer.from(`${h}.${p}`);
    const valid = verify(null, signingInput, this.publicKey, b64urlDecode(s));
    if (!valid) {
      throw new Error('Invalid license signature');
    }
    const claims = JSON.parse(b64urlDecode(p).toString()) as LicenseClaims;
    if (claims.exp * 1000 <= Date.now()) {
      throw new Error('License expired');
    }
    return claims;
  }
}
