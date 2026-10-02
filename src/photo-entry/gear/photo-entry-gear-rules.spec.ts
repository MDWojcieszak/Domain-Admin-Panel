import {
  GearCategory,
  GearOwnership,
  MediaStatus,
  PhotoEntryStatus,
} from '@prisma/client';

import {
  EntryGearPhase,
  EntryGearWarning,
  gearPhaseOf,
  listedInPhase,
  mediaSecured,
  resolveRowFlags,
  rowFlagsViolation,
  rowWarning,
  statusChangeConflict,
  uploadStatusOf,
} from './photo-entry-gear-rules';

const camera = (used: boolean, secured: boolean) => ({
  category: GearCategory.CAMERA,
  used,
  secured,
});
const tripod = (used: boolean) => ({
  category: GearCategory.TRIPOD,
  used,
  secured: false,
});

describe('gearPhaseOf (D4)', () => {
  it('maps each status to one reading of the list', () => {
    expect(gearPhaseOf(PhotoEntryStatus.PLANNED)).toBe(EntryGearPhase.PACK);
    expect(gearPhaseOf(PhotoEntryStatus.SHOT)).toBe(EntryGearPhase.SECURE);
    expect(gearPhaseOf(PhotoEntryStatus.CANCELLED)).toBe(EntryGearPhase.NONE);
  });
});

describe('listedInPhase', () => {
  it('packs everything', () => {
    expect(listedInPhase(EntryGearPhase.PACK, tripod(false))).toBe(true);
  });

  it('secures only used gear that produces media', () => {
    expect(listedInPhase(EntryGearPhase.SECURE, camera(true, false))).toBe(
      true,
    );
    expect(listedInPhase(EntryGearPhase.SECURE, camera(false, false))).toBe(
      false,
    );
    expect(listedInPhase(EntryGearPhase.SECURE, tripod(true))).toBe(false);
  });
});

describe('rowWarning (§4)', () => {
  it('flags sold gear on a planned trip', () => {
    expect(rowWarning(PhotoEntryStatus.PLANNED, GearOwnership.RETIRED)).toBe(
      EntryGearWarning.RETIRED,
    );
  });

  it('flags wishlist gear on a shoot that happened', () => {
    expect(rowWarning(PhotoEntryStatus.SHOT, GearOwnership.WISHLIST)).toBe(
      EntryGearWarning.NOT_OWNED,
    );
  });

  it('is quiet for the normal cases', () => {
    expect(
      rowWarning(PhotoEntryStatus.PLANNED, GearOwnership.WISHLIST),
    ).toBeNull();
    expect(rowWarning(PhotoEntryStatus.SHOT, GearOwnership.RETIRED)).toBeNull();
  });
});

describe('mediaSecured / uploadStatusOf (§6)', () => {
  const confirmed = new Date();

  it('is unknown until the gear is declared', () => {
    expect(mediaSecured(null, [])).toBeNull();
    expect(uploadStatusOf(null, [])).toBe(MediaStatus.NOT_UPLOADED);
  });

  it('is secured for a declared, empty list', () => {
    expect(mediaSecured(confirmed, [])).toBe(true);
  });

  it('waits for every used media source', () => {
    expect(
      mediaSecured(confirmed, [camera(true, true), camera(true, false)]),
    ).toBe(false);
    expect(uploadStatusOf(confirmed, [camera(true, true), tripod(true)])).toBe(
      MediaStatus.UPLOADED,
    );
  });

  it('ignores gear that was only planned', () => {
    expect(mediaSecured(confirmed, [camera(false, false)])).toBe(true);
  });
});

describe('resolveRowFlags', () => {
  it('securing implies use', () => {
    expect(
      resolveRowFlags({ used: false, secured: false }, { secured: true }),
    ).toEqual({ used: true, secured: true });
  });

  it('un-using clears securing', () => {
    expect(
      resolveRowFlags({ used: true, secured: true }, { used: false }),
    ).toEqual({ used: false, secured: false });
  });

  it('leaves omitted flags alone', () => {
    expect(resolveRowFlags({ used: true, secured: false }, {})).toEqual({
      used: true,
      secured: false,
    });
  });
});

describe('rowFlagsViolation', () => {
  const ctx = {
    entryStatus: PhotoEntryStatus.SHOT,
    ownership: GearOwnership.OWNED,
    category: GearCategory.CAMERA,
  };

  it('accepts used and secured owned gear on a shot entry', () => {
    expect(rowFlagsViolation(ctx, { used: true, secured: true })).toBeNull();
  });

  it('accepts planning flags anywhere', () => {
    expect(
      rowFlagsViolation(
        {
          ...ctx,
          entryStatus: PhotoEntryStatus.PLANNED,
          ownership: GearOwnership.WISHLIST,
        },
        { used: false, secured: false },
      ),
    ).toBeNull();
  });

  it('P13: refuses use before the shoot happened', () => {
    expect(
      rowFlagsViolation(
        { ...ctx, entryStatus: PhotoEntryStatus.PLANNED },
        { used: true, secured: false },
      ),
    ).toMatch(/SHOT/);
  });

  it('P11: refuses wishlist gear, allows retired gear for history', () => {
    expect(
      rowFlagsViolation(
        { ...ctx, ownership: GearOwnership.WISHLIST },
        { used: true, secured: false },
      ),
    ).toMatch(/Wishlist/);
    expect(
      rowFlagsViolation(
        { ...ctx, ownership: GearOwnership.RETIRED },
        { used: true, secured: true },
      ),
    ).toBeNull();
  });

  it('P3: refuses securing gear without media', () => {
    expect(
      rowFlagsViolation(
        { ...ctx, category: GearCategory.TRIPOD },
        { used: true, secured: true },
      ),
    ).toMatch(/nothing to secure/);
    expect(
      rowFlagsViolation(
        { ...ctx, category: GearCategory.TRIPOD },
        { used: true, secured: false },
      ),
    ).toBeNull();
  });
});

describe('statusChangeConflict (P13)', () => {
  it('refuses leaving SHOT while gear is recorded as used', () => {
    expect(
      statusChangeConflict(PhotoEntryStatus.PLANNED, [
        { used: true, secured: false },
      ]),
    ).toMatch(/used/);
  });

  it('allows it for plans only', () => {
    expect(
      statusChangeConflict(PhotoEntryStatus.CANCELLED, [
        { used: false, secured: false },
      ]),
    ).toBeNull();
  });
});
