import { PhotoEntryPostStage, PhotoEntryStatus } from '@prisma/client';

import {
  isHappeningNow,
  postStageConflict,
  remainingToEdit,
  shouldStampFirstEdited,
  wasTouched,
} from './photo-entry-derived';

const at = (iso: string) => new Date(iso);
const NOW = at('2026-07-15T12:00:00Z');

describe('isHappeningNow', () => {
  it('is true inside the window', () => {
    expect(
      isHappeningNow(
        {
          status: PhotoEntryStatus.SHOT,
          startDate: at('2026-07-14T00:00:00Z'),
          endDate: at('2026-07-16T00:00:00Z'),
        },
        NOW,
      ),
    ).toBe(true);
  });

  it('is false once the window has passed', () => {
    expect(
      isHappeningNow(
        {
          status: PhotoEntryStatus.SHOT,
          startDate: at('2026-01-01T00:00:00Z'),
          endDate: at('2026-01-03T00:00:00Z'),
        },
        NOW,
      ),
    ).toBe(false);
  });

  it('is false before the window opens', () => {
    expect(
      isHappeningNow(
        {
          status: PhotoEntryStatus.PLANNED,
          startDate: at('2026-12-01T00:00:00Z'),
          endDate: null,
        },
        NOW,
      ),
    ).toBe(false);
  });

  // D2 — the date knows, regardless of whether anyone flipped the status.
  it('is true for a PLANNED entry whose day is today', () => {
    expect(
      isHappeningNow(
        {
          status: PhotoEntryStatus.PLANNED,
          startDate: at('2026-07-15T08:00:00Z'),
          endDate: at('2026-07-15T20:00:00Z'),
        },
        NOW,
      ),
    ).toBe(true);
  });

  it('treats a missing endDate as a single moment', () => {
    const start = at('2026-07-15T12:00:00Z');

    expect(
      isHappeningNow(
        { status: PhotoEntryStatus.SHOT, startDate: start, endDate: null },
        NOW,
      ),
    ).toBe(true);
    expect(
      isHappeningNow(
        { status: PhotoEntryStatus.SHOT, startDate: start, endDate: null },
        at('2026-07-15T12:00:01Z'),
      ),
    ).toBe(false);
  });

  it('is never true for a cancelled entry', () => {
    expect(
      isHappeningNow(
        {
          status: PhotoEntryStatus.CANCELLED,
          startDate: at('2026-07-14T00:00:00Z'),
          endDate: at('2026-07-16T00:00:00Z'),
        },
        NOW,
      ),
    ).toBe(false);
  });

  it('is false without a start date', () => {
    expect(
      isHappeningNow(
        { status: PhotoEntryStatus.SHOT, startDate: null, endDate: null },
        NOW,
      ),
    ).toBe(false);
  });
});

describe('wasTouched', () => {
  it('is the "was edited" label, derived from the stage', () => {
    expect(wasTouched(PhotoEntryPostStage.NONE)).toBe(false);
    expect(wasTouched(PhotoEntryPostStage.SELECTING)).toBe(true);
    expect(wasTouched(PhotoEntryPostStage.EDITING)).toBe(true);
    expect(wasTouched(PhotoEntryPostStage.FINISHED)).toBe(true);
  });
});

describe('shouldStampFirstEdited', () => {
  it('stamps on the first move away from NONE', () => {
    expect(shouldStampFirstEdited(PhotoEntryPostStage.SELECTING, null)).toBe(
      true,
    );
  });

  // Jumping straight to FINISHED still means the material was worked on.
  it('stamps when jumping straight to FINISHED', () => {
    expect(shouldStampFirstEdited(PhotoEntryPostStage.FINISHED, null)).toBe(
      true,
    );
  });

  // P2 — set once, never overwritten.
  it('never re-stamps an entry that already has a date', () => {
    expect(
      shouldStampFirstEdited(
        PhotoEntryPostStage.EDITING,
        at('2026-02-02T00:00:00Z'),
      ),
    ).toBe(false);
  });

  it('does not stamp a move back to NONE', () => {
    expect(shouldStampFirstEdited(PhotoEntryPostStage.NONE, null)).toBe(false);
  });
});

describe('remainingToEdit', () => {
  it('subtracts edited from selected', () => {
    expect(remainingToEdit(200, 190)).toBe(10);
  });

  // "No idea" must not render as "nothing left".
  it('is null when either count is unknown', () => {
    expect(remainingToEdit(null, 10)).toBeNull();
    expect(remainingToEdit(200, null)).toBeNull();
    expect(remainingToEdit(null, null)).toBeNull();
  });

  it('never goes negative', () => {
    expect(remainingToEdit(10, 15)).toBe(0);
  });
});

describe('postStageConflict', () => {
  // P1 — you cannot process what has not happened.
  it('rejects post-processing on a PLANNED entry', () => {
    expect(
      postStageConflict(PhotoEntryStatus.PLANNED, PhotoEntryPostStage.EDITING),
    ).toMatch(/has not happened/);
  });

  it('allows PLANNED with NONE', () => {
    expect(
      postStageConflict(PhotoEntryStatus.PLANNED, PhotoEntryPostStage.NONE),
    ).toBeNull();
  });

  it('allows any stage once the shoot happened', () => {
    for (const stage of Object.values(PhotoEntryPostStage)) {
      expect(postStageConflict(PhotoEntryStatus.SHOT, stage)).toBeNull();
    }
  });

  // A cancelled shoot may still have material that was worked on before.
  it('does not constrain a cancelled entry', () => {
    expect(
      postStageConflict(
        PhotoEntryStatus.CANCELLED,
        PhotoEntryPostStage.FINISHED,
      ),
    ).toBeNull();
  });
});
