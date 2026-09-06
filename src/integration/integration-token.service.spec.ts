import { AccountStatus, IntegrationPlatform, Role } from '@prisma/client';
import { createHash } from 'crypto';

import { IntegrationTokenService } from './integration-token.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

function makeService() {
  const prisma = {
    integrationToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const service = new IntegrationTokenService(prisma as any);
  return { service, prisma };
}

const activeUser = {
  role: Role.USER,
  accountStatus: AccountStatus.ACTIVE,
  deletedAt: null,
};

/** Builds a stored row that matches a given raw token. */
function rowFor(raw: string, overrides: Record<string, unknown> = {}) {
  const secret = raw.split('_')[2];
  return {
    id: 'tok1',
    userId: 'u1',
    scopes: ['photoEntry.read'],
    tokenHash: createHash('sha256').update(secret, 'utf8').digest('hex'),
    expiresAt: null,
    revokedAt: null,
    lastUsedAt: null,
    lastUsedIp: null,
    user: activeUser,
    ...overrides,
  };
}

async function issueRaw(service: IntegrationTokenService, prisma: any) {
  prisma.integrationToken.create.mockResolvedValueOnce({
    id: 'tok1',
    expiresAt: null,
  });
  const issued = await service.issue({
    userId: 'u1',
    name: 'Photo Desktop',
    platform: IntegrationPlatform.WINDOWS,
    scopes: ['photoEntry.read'],
    expiresAt: null,
  });
  return issued.value;
}

describe('IntegrationTokenService', () => {
  describe('issue', () => {
    it('mints whcp_<tokenId>_<secret> and stores only the hash', async () => {
      const { service, prisma } = makeService();
      const raw = await issueRaw(service, prisma);

      const [prefix, tokenId, secret] = raw.split('_');
      expect(prefix).toBe('whcp');
      expect(tokenId).toMatch(/^[0-9a-f]{16}$/);
      expect(secret).toMatch(/^[0-9a-f]{64}$/);

      const stored = prisma.integrationToken.create.mock.calls[0][0].data;
      expect(stored.tokenHash).toBe(
        createHash('sha256').update(secret, 'utf8').digest('hex'),
      );
      // The plaintext must not be anywhere in the row.
      expect(JSON.stringify(stored)).not.toContain(secret);
      expect(stored.lastFour).toBe(secret.slice(-4));
    });

    it('splits cleanly even though the secret is opaque', async () => {
      const { service, prisma } = makeService();
      const raw = await issueRaw(service, prisma);
      // Hex on both halves is the reason this holds — base64url would put `_`
      // inside the secret and break the split.
      expect(raw.split('_')).toHaveLength(3);
    });

    it('rejects scopes outside the ACL catalog', async () => {
      const { service } = makeService();

      await expect(
        service.issue({
          userId: 'u1',
          name: 'x',
          platform: IntegrationPlatform.OTHER,
          scopes: ['photoEntry.read', 'not.a.real.permission'],
        }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('rejects an empty scope list', async () => {
      const { service } = makeService();

      await expect(
        service.issue({
          userId: 'u1',
          name: 'x',
          platform: IntegrationPlatform.OTHER,
          scopes: [],
        }),
      ).rejects.toMatchObject({ status: 400 });
    });
  });

  describe('verify', () => {
    it('resolves a valid token with one indexed lookup', async () => {
      const { service, prisma } = makeService();
      const raw = await issueRaw(service, prisma);
      prisma.integrationToken.findUnique.mockResolvedValueOnce(rowFor(raw));

      const result = await service.verify(raw);

      expect(result).toMatchObject({
        id: 'tok1',
        userId: 'u1',
        role: Role.USER,
        scopes: ['photoEntry.read'],
      });
      expect(prisma.integrationToken.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.integrationToken.findUnique.mock.calls[0][0].where).toEqual(
        { tokenId: raw.split('_')[1] },
      );
    });

    it('accepts a token with no expiry at all', async () => {
      const { service, prisma } = makeService();
      const raw = await issueRaw(service, prisma);
      prisma.integrationToken.findUnique.mockResolvedValueOnce(
        rowFor(raw, { expiresAt: null }),
      );

      // The old TokenGuard filtered `expiresAt >= now`, which drops NULLs in
      // SQL and made every non-expiring token it issued unusable.
      await expect(service.verify(raw)).resolves.not.toBeNull();
    });

    it('rejects a revoked token', async () => {
      const { service, prisma } = makeService();
      const raw = await issueRaw(service, prisma);
      prisma.integrationToken.findUnique.mockResolvedValueOnce(
        rowFor(raw, { revokedAt: new Date() }),
      );

      await expect(service.verify(raw)).resolves.toBeNull();
    });

    it('rejects an expired token', async () => {
      const { service, prisma } = makeService();
      const raw = await issueRaw(service, prisma);
      prisma.integrationToken.findUnique.mockResolvedValueOnce(
        rowFor(raw, { expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(service.verify(raw)).resolves.toBeNull();
    });

    it('rejects a token whose account was disabled or deleted', async () => {
      const { service, prisma } = makeService();
      const raw = await issueRaw(service, prisma);

      prisma.integrationToken.findUnique.mockResolvedValueOnce(
        rowFor(raw, {
          user: { ...activeUser, accountStatus: AccountStatus.DISABLED },
        }),
      );
      await expect(service.verify(raw)).resolves.toBeNull();

      prisma.integrationToken.findUnique.mockResolvedValueOnce(
        rowFor(raw, { user: { ...activeUser, deletedAt: new Date() } }),
      );
      await expect(service.verify(raw)).resolves.toBeNull();
    });

    it('rejects a right tokenId paired with a wrong secret', async () => {
      const { service, prisma } = makeService();
      const raw = await issueRaw(service, prisma);
      const [prefix, tokenId] = raw.split('_');
      prisma.integrationToken.findUnique.mockResolvedValueOnce(rowFor(raw));

      const forged = `${prefix}_${tokenId}_${'0'.repeat(64)}`;
      await expect(service.verify(forged)).resolves.toBeNull();
    });

    it('rejects malformed input without touching the database', async () => {
      const { service, prisma } = makeService();

      for (const bad of [
        '',
        'whcp',
        'whcp_only-one-half',
        'Bearer abc',
        'a_b_c_d',
      ]) {
        await expect(service.verify(bad)).resolves.toBeNull();
      }
      expect(prisma.integrationToken.findUnique).not.toHaveBeenCalled();
    });

    it('does not rewrite lastUsedAt on every single call', async () => {
      const { service, prisma } = makeService();
      const raw = await issueRaw(service, prisma);
      prisma.integrationToken.findUnique.mockResolvedValueOnce(
        rowFor(raw, { lastUsedAt: new Date(), lastUsedIp: '1.2.3.4' }),
      );

      await service.verify(raw, '1.2.3.4');

      expect(prisma.integrationToken.update).not.toHaveBeenCalled();
    });

    it('records usage once the stored timestamp is stale', async () => {
      const { service, prisma } = makeService();
      const raw = await issueRaw(service, prisma);
      prisma.integrationToken.findUnique.mockResolvedValueOnce(
        rowFor(raw, {
          lastUsedAt: new Date(Date.now() - 60 * 60 * 1000),
          lastUsedIp: '1.2.3.4',
        }),
      );

      await service.verify(raw, '1.2.3.4');

      expect(prisma.integrationToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lastUsedIp: '1.2.3.4' }),
        }),
      );
    });
  });

  describe('looksLikeIntegrationToken', () => {
    it('only claims our own prefix, so JWTs still take the JWT path', () => {
      expect(
        IntegrationTokenService.looksLikeIntegrationToken('whcp_a_b'),
      ).toBe(true);
      expect(
        IntegrationTokenService.looksLikeIntegrationToken(
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.abc',
        ),
      ).toBe(false);
    });
  });
});
