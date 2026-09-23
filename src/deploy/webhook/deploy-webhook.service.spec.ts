import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ReleaseTrigger } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ReleaseService } from '../release/release.service';
import { SecretCryptoService } from '../secrets/secret-crypto.service';
import { DeployWebhookService } from './deploy-webhook.service';

const SECRET = 'a'.repeat(64);

describe('DeployWebhookService', () => {
  let prisma: any;
  let releases: any;
  let crypto: any;
  let audit: any;
  let service: DeployWebhookService;

  const enabled = {
    id: 'app-1',
    slug: 'photo-gallery-backend',
    webhookEnabled: true,
    webhookSecret: 'encrypted',
  };

  beforeEach(() => {
    prisma = {
      application: {
        findFirst: jest.fn().mockResolvedValue({ ...enabled }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    releases = {
      create: jest
        .fn()
        .mockResolvedValue({ releaseId: 'rel-1', processId: 'proc-1' }),
    };
    crypto = {
      encrypt: jest.fn().mockReturnValue('encrypted'),
      decrypt: jest.fn().mockReturnValue(SECRET),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };

    service = new DeployWebhookService(
      prisma as PrismaService,
      releases as ReleaseService,
      crypto as SecretCryptoService,
      audit as AuditService,
    );
  });

  describe('handle', () => {
    it('starts a deployment with the WEBHOOK trigger', async () => {
      const result = await service.handle('photo-gallery-backend', SECRET, {
        version: '0.3.0',
        digest: 'sha256:abc',
      });

      expect(result).toEqual({ releaseId: 'rel-1', processId: 'proc-1' });
      expect(releases.create).toHaveBeenCalledWith('app-1', {
        version: '0.3.0',
        digest: 'sha256:abc',
        trigger: ReleaseTrigger.WEBHOOK,
      });
    });

    // No human approved a diff here, so there is no hash to echo back.
    it('sends no composeHash', async () => {
      await service.handle('photo-gallery-backend', SECRET, {
        version: '0.3.0',
      });

      expect(releases.create.mock.calls[0][1]).not.toHaveProperty(
        'composeHash',
      );
    });

    it('rejects a wrong secret', async () => {
      await expect(
        service.handle('photo-gallery-backend', 'b'.repeat(64), {
          version: '1',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(releases.create).not.toHaveBeenCalled();
    });

    it('rejects a missing secret', async () => {
      await expect(
        service.handle('photo-gallery-backend', undefined, { version: '1' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a secret of a different length without throwing', async () => {
      await expect(
        service.handle('photo-gallery-backend', 'short', { version: '1' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when the webhook is disabled', async () => {
      prisma.application.findFirst.mockResolvedValue({
        ...enabled,
        webhookEnabled: false,
      });

      await expect(
        service.handle('photo-gallery-backend', SECRET, { version: '1' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    // Same error for every failure mode, so a probe cannot enumerate apps.
    it('reports an unknown application the same way as a bad secret', async () => {
      prisma.application.findFirst.mockResolvedValue(null);

      await expect(
        service.handle('does-not-exist', SECRET, { version: '1' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a payload that identifies nothing', async () => {
      await expect(
        service.handle('photo-gallery-backend', SECRET, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('survives an undecryptable stored secret', async () => {
      crypto.decrypt.mockImplementation(() => {
        throw new Error('key rotated');
      });

      await expect(
        service.handle('photo-gallery-backend', SECRET, { version: '1' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('rotateSecret', () => {
    it('returns a fresh secret and stores it encrypted', async () => {
      const secret = await service.rotateSecret('app-1', 'user-1');

      expect(secret).toHaveLength(64);
      expect(crypto.encrypt).toHaveBeenCalledWith(secret);
      expect(prisma.application.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { webhookSecret: 'encrypted', webhookEnabled: true },
        }),
      );
    });

    it('never records the secret in the audit diff', async () => {
      const secret = await service.rotateSecret('app-1', 'user-1');

      expect(JSON.stringify(audit.record.mock.calls[0][0])).not.toContain(
        secret,
      );
    });

    it('issues a different secret every time', async () => {
      const first = await service.rotateSecret('app-1');
      const second = await service.rotateSecret('app-1');

      expect(first).not.toBe(second);
    });
  });

  describe('disable', () => {
    it('clears the secret as well as the flag', async () => {
      await service.disable('app-1', 'user-1');

      expect(prisma.application.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { webhookEnabled: false, webhookSecret: null },
        }),
      );
    });
  });
});
