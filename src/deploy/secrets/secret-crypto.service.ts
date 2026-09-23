import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

/**
 * Encrypts deployment secrets at rest: global variable values, per-application
 * secret env values and git tokens (§10.4).
 *
 * Same construction as TokenService (AES-256-GCM, key derived from a configured
 * secret via SHA-256) but stored as a single self-describing string, because the
 * columns it protects are plain `String` rather than JSON.
 *
 * Format: `v1:<iv-hex>:<tag-hex>:<cipher-hex>`. The version prefix exists so a
 * future key rotation can recognise and re-wrap older values.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const VERSION = 'v1';

@Injectable()
export class SecretCryptoService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const secret = config.get<string>('DEPLOY_SECRET_KEY');

    if (!secret) {
      throw new Error('DEPLOY_SECRET_KEY is not set');
    }

    // Derive a fixed 32-byte key so any secret string works, deterministically.
    this.key = createHash('sha256').update(secret, 'utf8').digest();
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    return [
      VERSION,
      iv.toString('hex'),
      cipher.getAuthTag().toString('hex'),
      encrypted.toString('hex'),
    ].join(':');
  }

  decrypt(stored: string): string {
    const parts = stored.split(':');

    if (parts.length !== 4 || parts[0] !== VERSION) {
      throw new InternalServerErrorException(
        'Stored secret is malformed or was written with an unknown format version.',
      );
    }

    const [, ivHex, tagHex, cipherHex] = parts;

    try {
      const decipher = createDecipheriv(
        ALGORITHM,
        this.key,
        Buffer.from(ivHex, 'hex'),
      );
      decipher.setAuthTag(Buffer.from(tagHex, 'hex'));

      return Buffer.concat([
        decipher.update(Buffer.from(cipherHex, 'hex')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      // Authentication failure means either tampering or a rotated key. Never
      // leak which, and never fall back to returning the ciphertext.
      throw new InternalServerErrorException(
        'Stored secret could not be decrypted; DEPLOY_SECRET_KEY may have changed.',
      );
    }
  }

  /** True when a stored value carries this service's envelope. */
  isEncrypted(stored: string): boolean {
    return stored.startsWith(`${VERSION}:`) && stored.split(':').length === 4;
  }
}
