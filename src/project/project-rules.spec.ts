import { ProjectRole, StatusCategory } from '@prisma/client';

import { ProjectAccess, allows } from './project-access.service';
import {
  INBOX_KEY,
  PROJECT_KEY,
  deriveProjectKey,
  taskKey,
} from './project-defaults';
import { hashShareToken, isLinkActive } from './project-share.service';
import { completion } from './task.service';

describe('deriveProjectKey (D14)', () => {
  const none = new Set<string>();

  it('takes initials of several words, the start of a single one', () => {
    expect(deriveProjectKey('Astro mount build', none)).toBe('AMB');
    expect(deriveProjectKey('Astro', none)).toBe('ASTRO');
    expect(deriveProjectKey('Zakupy na święta', none)).toBe('ZNS');
  });

  it('turns Polish letters into plain ones', () => {
    expect(deriveProjectKey('Łódź', none)).toBe('LODZ');
  });

  it('appends a number when the key is taken, and never yields INBOX', () => {
    expect(deriveProjectKey('Astro', new Set(['ASTRO']))).toBe('ASTRO2');
    expect(deriveProjectKey('Inbox', none)).not.toBe(INBOX_KEY);
  });

  it('always produces a valid key, even from odd titles', () => {
    for (const title of [
      '2026 plan',
      'a',
      '!!!',
      'x y',
      'Very long single word',
    ]) {
      expect(deriveProjectKey(title, none)).toMatch(PROJECT_KEY);
    }
  });

  it('builds task keys as KEY-number', () => {
    expect(taskKey('ASTRO', 12)).toBe('ASTRO-12');
  });
});

describe('allows (D2)', () => {
  it('lets viewers only look, unless the project lets them tick things off', () => {
    expect(allows(ProjectRole.VIEWER, ProjectAccess.VIEW, false)).toBe(true);
    expect(allows(ProjectRole.VIEWER, ProjectAccess.CHECK, false)).toBe(false);
    expect(allows(ProjectRole.VIEWER, ProjectAccess.CHECK, true)).toBe(true);
    expect(allows(ProjectRole.VIEWER, ProjectAccess.EDIT, true)).toBe(false);
  });

  it('lets editors do everything but own the project', () => {
    expect(allows(ProjectRole.EDITOR, ProjectAccess.EDIT, false)).toBe(true);
    expect(allows(ProjectRole.EDITOR, ProjectAccess.OWN, false)).toBe(false);
    expect(allows(ProjectRole.OWNER, ProjectAccess.OWN, false)).toBe(true);
  });
});

describe('completion (I8)', () => {
  it('stamps completion on entering a done status, by whoever did it', () => {
    expect(completion(StatusCategory.TODO, StatusCategory.DONE, 'u1')).toEqual({
      completedAt: expect.any(Date),
      completedById: 'u1',
    });
  });

  it('clears it on leaving, and leaves it alone between done statuses', () => {
    expect(
      completion(StatusCategory.DONE, StatusCategory.IN_PROGRESS, 'u1'),
    ).toEqual({ completedAt: null, completedById: null });
    expect(completion(StatusCategory.DONE, StatusCategory.DONE, 'u1')).toEqual(
      {},
    );
    expect(
      completion(StatusCategory.TODO, StatusCategory.IN_PROGRESS, 'u1'),
    ).toEqual({});
  });
});

describe('share links (D3, I3)', () => {
  it('stores a hash, never the token', () => {
    const hash = hashShareToken('abc');
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain('abc');
    expect(hashShareToken('abc')).toBe(hash);
  });

  it('is active until revoked or past its expiry', () => {
    const now = new Date('2026-10-25T12:00:00Z');
    const later = new Date('2026-10-26T12:00:00Z');
    const earlier = new Date('2026-10-24T12:00:00Z');
    expect(isLinkActive({ revokedAt: null, expiresAt: null }, now)).toBe(true);
    expect(isLinkActive({ revokedAt: null, expiresAt: later }, now)).toBe(true);
    expect(isLinkActive({ revokedAt: null, expiresAt: earlier }, now)).toBe(
      false,
    );
    expect(isLinkActive({ revokedAt: earlier, expiresAt: null }, now)).toBe(
      false,
    );
  });

  it('records a tick from a link without anyone to credit', () => {
    expect(completion(StatusCategory.TODO, StatusCategory.DONE, null)).toEqual({
      completedAt: expect.any(Date),
      completedById: null,
    });
  });
});
