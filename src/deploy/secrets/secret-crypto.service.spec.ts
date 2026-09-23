import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';

import { SecretCryptoService } from './secret-crypto.service';

const configWith = (key?: string) =>
  ({ get: () => key }) as unknown as ConfigService;

describe('SecretCryptoService', () => {
  let service: SecretCryptoService;

  beforeEach(() => {
    service = new SecretCryptoService(configWith('test-deploy-key'));
  });

  it('refuses to construct without a configured key', () => {
    expect(() => new SecretCryptoService(configWith(undefined))).toThrow(
      /DEPLOY_SECRET_KEY is not set/,
    );
  });

  it('round-trips a value', () => {
    const encrypted = service.encrypt('hunter2');

    expect(encrypted).not.toContain('hunter2');
    expect(service.decrypt(encrypted)).toBe('hunter2');
  });

  it('round-trips unicode and an empty string', () => {
    for (const value of ['zażółć gęślą jaźń', '', '🔐 secret']) {
      expect(service.decrypt(service.encrypt(value))).toBe(value);
    }
  });

  it('produces a different ciphertext each time', () => {
    expect(service.encrypt('same')).not.toBe(service.encrypt('same'));
  });

  it('marks its own output as encrypted and plaintext as not', () => {
    expect(service.isEncrypted(service.encrypt('x'))).toBe(true);
    expect(service.isEncrypted('plain value')).toBe(false);
    expect(service.isEncrypted('v1:only:three')).toBe(false);
  });

  it('rejects a malformed envelope', () => {
    expect(() => service.decrypt('not-encrypted')).toThrow(
      InternalServerErrorException,
    );
    expect(() => service.decrypt('v2:a:b:c')).toThrow(/unknown format version/);
  });

  it('rejects a tampered ciphertext instead of returning garbage', () => {
    const [version, iv, tag, cipher] = service.encrypt('hunter2').split(':');
    const flipped = cipher.startsWith('0')
      ? `1${cipher.slice(1)}`
      : `0${cipher.slice(1)}`;

    expect(() =>
      service.decrypt([version, iv, tag, flipped].join(':')),
    ).toThrow(/could not be decrypted/);
  });

  it('cannot decrypt a value written under a different key', () => {
    const other = new SecretCryptoService(configWith('a-different-key'));

    expect(() => other.decrypt(service.encrypt('hunter2'))).toThrow(
      /could not be decrypted/,
    );
  });
});
