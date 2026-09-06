import { DeviceAuthorizationStatus, IntegrationPlatform } from '@prisma/client';
import { createHash } from 'crypto';

import { DeviceAuthorizationService } from './device-authorization.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

// `null` means "not configured" — passing `undefined` would just re-trigger
// the default parameter and quietly test the configured path instead.
function makeService(
  interfaceUrl: string | null = 'https://panel.example.com/',
) {
  const prisma = {
    deviceAuthorization: {
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const tokens = {
    assertValidScopes: jest.fn((scopes: string[]) => scopes),
    issue: jest.fn().mockResolvedValue({
      id: 'tok1',
      value: 'whcp_aaaa_bbbb',
      expiresAt: null,
    }),
  };
  const config = { get: () => interfaceUrl ?? undefined };
  const service = new DeviceAuthorizationService(
    prisma as any,
    tokens as any,
    config as any,
  );
  return { service, prisma, tokens };
}

const sha256 = (v: string) =>
  createHash('sha256').update(v, 'utf8').digest('hex');

function pending(overrides: Record<string, unknown> = {}) {
  return {
    id: 'da1',
    userCode: 'WXYZ-1234',
    deviceCodeHash: sha256('devicecode'),
    clientName: 'Photo Desktop',
    platform: IntegrationPlatform.WINDOWS,
    scopes: ['photoEntry.read'],
    status: DeviceAuthorizationStatus.PENDING,
    approvedById: null,
    issuedTokenId: null,
    expiresAt: new Date(Date.now() + 60_000),
    lastPolledAt: null,
    ...overrides,
  };
}

describe('DeviceAuthorizationService', () => {
  describe('authorize', () => {
    it('returns a readable user code and a pre-filled approval URL', async () => {
      const { service, prisma } = makeService();
      prisma.deviceAuthorization.findUnique.mockResolvedValue(null);

      const result = await service.authorize({
        clientName: 'Photo Desktop',
        platform: IntegrationPlatform.WINDOWS,
        scopes: ['photoEntry.read'],
      });

      expect(result.userCode).toMatch(/^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
      // No 0/O/1/I/L — the code has to survive being retyped off a screen.
      expect(result.userCode).not.toMatch(/[01OIL]/);
      expect(result.verificationUriComplete).toBe(
        `https://panel.example.com/activate?code=${result.userCode}`,
      );
      expect(result.interval).toBeGreaterThan(0);
    });

    it('fails loudly when INTERFACE_URL is not configured', async () => {
      const { service, prisma } = makeService(null);
      prisma.deviceAuthorization.findUnique.mockResolvedValue(null);

      // The alternative — defaulting to this API's own address — hands the app
      // a URL that resolves to the wrong service, then leaves it polling
      // authorization_pending until the code expires with nothing to explain it.
      await expect(
        service.authorize({
          clientName: 'Photo Desktop',
          platform: IntegrationPlatform.WINDOWS,
          scopes: ['photoEntry.read'],
        }),
      ).rejects.toMatchObject({ status: 500 });
    });

    it('stores only the hash of the device code', async () => {
      const { service, prisma } = makeService();
      prisma.deviceAuthorization.findUnique.mockResolvedValue(null);

      const result = await service.authorize({
        clientName: 'Photo Desktop',
        platform: IntegrationPlatform.WINDOWS,
        scopes: ['photoEntry.read'],
      });

      const stored = prisma.deviceAuthorization.create.mock.calls[0][0].data;
      expect(stored.deviceCodeHash).toBe(sha256(result.deviceCode));
      expect(JSON.stringify(stored)).not.toContain(result.deviceCode);
    });
  });

  describe('poll', () => {
    it('reports authorization_pending until the user decides', async () => {
      const { service, prisma } = makeService();
      prisma.deviceAuthorization.findUnique.mockResolvedValueOnce(pending());

      await expect(service.poll('devicecode')).rejects.toMatchObject({
        response: { error: 'authorization_pending' },
      });
    });

    it('reports access_denied after a refusal', async () => {
      const { service, prisma } = makeService();
      prisma.deviceAuthorization.findUnique.mockResolvedValueOnce(
        pending({ status: DeviceAuthorizationStatus.DENIED }),
      );

      await expect(service.poll('devicecode')).rejects.toMatchObject({
        response: { error: 'access_denied' },
      });
    });

    it('reports expired_token past the window', async () => {
      const { service, prisma } = makeService();
      prisma.deviceAuthorization.findUnique.mockResolvedValueOnce(
        pending({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(service.poll('devicecode')).rejects.toMatchObject({
        response: { error: 'expired_token' },
      });
    });

    it('reports slow_down when polling faster than the interval', async () => {
      const { service, prisma } = makeService();
      prisma.deviceAuthorization.findUnique.mockResolvedValueOnce(
        pending({ lastPolledAt: new Date() }),
      );

      await expect(service.poll('devicecode')).rejects.toMatchObject({
        response: { error: 'slow_down' },
      });
    });

    it('mints the token at collect time, for the approving user', async () => {
      const { service, prisma, tokens } = makeService();
      prisma.deviceAuthorization.findUnique.mockResolvedValueOnce(
        pending({
          status: DeviceAuthorizationStatus.APPROVED,
          approvedById: 'u1',
        }),
      );

      const result = await service.poll('devicecode');

      expect(result.token).toBe('whcp_aaaa_bbbb');
      expect(tokens.issue).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          name: 'Photo Desktop',
          platform: IntegrationPlatform.WINDOWS,
          scopes: ['photoEntry.read'],
        }),
      );
      // Linked so the next poll cannot mint a second token.
      expect(prisma.deviceAuthorization.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { issuedTokenId: 'tok1' } }),
      );
    });

    it('refuses a replayed device code once the token was collected', async () => {
      const { service, prisma, tokens } = makeService();
      prisma.deviceAuthorization.findUnique.mockResolvedValueOnce(
        pending({
          status: DeviceAuthorizationStatus.APPROVED,
          approvedById: 'u1',
          issuedTokenId: 'tok1',
        }),
      );

      await expect(service.poll('devicecode')).rejects.toMatchObject({
        response: { error: 'invalid_grant' },
      });
      expect(tokens.issue).not.toHaveBeenCalled();
    });

    it('refuses an unknown device code', async () => {
      const { service, prisma } = makeService();
      prisma.deviceAuthorization.findUnique.mockResolvedValueOnce(null);

      await expect(service.poll('nope')).rejects.toMatchObject({
        response: { error: 'invalid_grant' },
      });
    });
  });

  describe('approve', () => {
    it('marks the handshake approved for the signed-in user', async () => {
      const { service, prisma } = makeService();
      prisma.deviceAuthorization.findUnique.mockResolvedValueOnce(pending());

      const result = await service.approve('u1', 'WXYZ-1234');

      expect(result.status).toBe(DeviceAuthorizationStatus.APPROVED);
      expect(prisma.deviceAuthorization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            status: DeviceAuthorizationStatus.APPROVED,
            approvedById: 'u1',
          },
        }),
      );
    });

    it('accepts the code as a human would paste it', async () => {
      const { service, prisma } = makeService();
      prisma.deviceAuthorization.findUnique.mockResolvedValueOnce(pending());

      await service.approve('u1', ' wxyz1234 ');

      expect(prisma.deviceAuthorization.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userCode: 'WXYZ-1234' } }),
      );
    });

    it('refuses to approve the same code twice', async () => {
      const { service, prisma } = makeService();
      prisma.deviceAuthorization.findUnique.mockResolvedValueOnce(
        pending({ status: DeviceAuthorizationStatus.APPROVED }),
      );

      await expect(service.approve('u1', 'WXYZ-1234')).rejects.toMatchObject({
        status: 400,
      });
    });

    it('refuses an expired code', async () => {
      const { service, prisma } = makeService();
      prisma.deviceAuthorization.findUnique.mockResolvedValueOnce(
        pending({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(service.approve('u1', 'WXYZ-1234')).rejects.toMatchObject({
        status: 400,
      });
    });
  });
});
