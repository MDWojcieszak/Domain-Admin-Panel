import { Role } from '@prisma/client';

import { PermissionsGuard } from './permissions.guard';
import { SessionOnlyGuard } from './session-only.guard';

/* eslint-disable @typescript-eslint/no-explicit-any */

function makeContext(user: unknown) {
  return {
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as any;
}

function makeGuard(required: string[] | undefined, groupPermissions: string[]) {
  const reflector = { getAllAndOverride: () => required };
  const permissionsService = {
    getEffectivePermissions: jest
      .fn()
      .mockResolvedValue(new Set(groupPermissions)),
  };
  const guard = new PermissionsGuard(
    reflector as any,
    permissionsService as any,
  );
  return { guard, permissionsService };
}

describe('PermissionsGuard', () => {
  describe('signed-in session (no scopes)', () => {
    it('lets OWNER through without consulting groups', async () => {
      const { guard, permissionsService } = makeGuard(['acl.manage'], []);

      await expect(
        guard.canActivate(makeContext({ sub: 'u1', role: Role.OWNER })),
      ).resolves.toBe(true);
      expect(permissionsService.getEffectivePermissions).not.toHaveBeenCalled();
    });

    it('checks a normal user against their groups', async () => {
      const { guard } = makeGuard(['photoEntry.read'], ['photoEntry.read']);

      await expect(
        guard.canActivate(makeContext({ sub: 'u1', role: Role.USER })),
      ).resolves.toBe(true);
    });

    it('rejects a permission the user does not have', async () => {
      const { guard } = makeGuard(['acl.manage'], ['photoEntry.read']);

      await expect(
        guard.canActivate(makeContext({ sub: 'u1', role: Role.USER })),
      ).rejects.toMatchObject({ status: 403 });
    });
  });

  describe('integration token (scoped)', () => {
    it('allows a permission that is both scoped and held', async () => {
      const { guard } = makeGuard(['photoEntry.read'], ['photoEntry.read']);

      await expect(
        guard.canActivate(
          makeContext({
            sub: 'u1',
            role: Role.USER,
            scopes: ['photoEntry.read'],
            integrationTokenId: 'tok1',
          }),
        ),
      ).resolves.toBe(true);
    });

    it('refuses a permission the user has but the token was not granted', async () => {
      const { guard } = makeGuard(
        ['acl.manage'],
        ['acl.manage', 'photoEntry.read'],
      );

      await expect(
        guard.canActivate(
          makeContext({
            sub: 'u1',
            role: Role.USER,
            scopes: ['photoEntry.read'],
            integrationTokenId: 'tok1',
          }),
        ),
      ).rejects.toMatchObject({ status: 403 });
    });

    it('refuses a scope the user themselves does not have', async () => {
      // A token can never be an escalation path: scopes are capped by the
      // owner's own permissions, not the other way round.
      const { guard } = makeGuard(['acl.manage'], ['photoEntry.read']);

      await expect(
        guard.canActivate(
          makeContext({
            sub: 'u1',
            role: Role.USER,
            scopes: ['acl.manage'],
            integrationTokenId: 'tok1',
          }),
        ),
      ).rejects.toMatchObject({ status: 403 });
    });

    it('does NOT let a scoped token inherit the OWNER bypass', async () => {
      // The whole point: a token scoped to photo entries, issued on an owner
      // account, must not turn into a full administrative key.
      const { guard } = makeGuard(['acl.manage'], []);

      await expect(
        guard.canActivate(
          makeContext({
            sub: 'u1',
            role: Role.OWNER,
            scopes: ['photoEntry.read'],
            integrationTokenId: 'tok1',
          }),
        ),
      ).rejects.toMatchObject({ status: 403 });
    });

    it("still honours an owner's token within its own scopes", async () => {
      // Owners have no permission groups, so intersecting with the group set
      // alone would leave their desktop app with no access at all.
      const { guard } = makeGuard(['photoEntry.read'], []);

      await expect(
        guard.canActivate(
          makeContext({
            sub: 'u1',
            role: Role.OWNER,
            scopes: ['photoEntry.read'],
            integrationTokenId: 'tok1',
          }),
        ),
      ).resolves.toBe(true);
    });
  });

  it('skips the check entirely on routes with no @RequirePermissions', async () => {
    const { guard } = makeGuard(undefined, []);

    await expect(guard.canActivate(makeContext(undefined))).resolves.toBe(true);
  });
});

describe('SessionOnlyGuard', () => {
  it('blocks an integration token from minting another one', () => {
    const guard = new SessionOnlyGuard();

    expect(() =>
      guard.canActivate(
        makeContext({ sub: 'u1', role: Role.USER, integrationTokenId: 'tok1' }),
      ),
    ).toThrow(/signed-in session/);
  });

  it('lets a normal session through', () => {
    const guard = new SessionOnlyGuard();

    expect(guard.canActivate(makeContext({ sub: 'u1', role: Role.USER }))).toBe(
      true,
    );
  });
});
