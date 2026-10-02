import { PhotoEntryCountsSource } from '@prisma/client';

import {
  countFrames,
  frameKey,
  isIgnoredDir,
  isPhotoFile,
  reconcileCounts,
  scanMayOverwrite,
} from './folder-counts';

describe('isPhotoFile', () => {
  it('counts raw and rendered photos, case-insensitively', () => {
    expect(isPhotoFile('DSCF0001.RAF')).toBe(true);
    expect(isPhotoFile('DSCF0001.jpg')).toBe(true);
    expect(isPhotoFile('pano.TIFF')).toBe(true);
  });

  it('never counts sidecars, videos or system files', () => {
    for (const name of [
      'DSCF0001.xmp',
      'DSCF0001.pp3',
      'DSCF0001.MOV',
      '._DSCF0001.RAF',
      'Thumbs.db',
      '.DS_Store',
      'README',
    ]) {
      expect(isPhotoFile(name)).toBe(false);
    }
  });
});

describe('isIgnoredDir', () => {
  it('skips caches, snapshots and catalogs', () => {
    for (const name of ['.zfs', '@eaDir', '#recycle', 'CaptureOne']) {
      expect(isIgnoredDir(name)).toBe(true);
    }
    expect(isIgnoredDir('GFX')).toBe(false);
  });
});

describe('frameKey / countFrames', () => {
  it('counts a RAW+JPEG pair as one frame', () => {
    expect(
      countFrames(['RAW/DSCF0001.RAF', 'JPEG/DSCF0001.JPG'], ['RAW', 'JPEG']),
    ).toBe(1);
  });

  it('keeps same-named frames from different bodies apart', () => {
    expect(
      countFrames(
        ['RAW/GFX/DSCF0001.RAF', 'RAW/X-T5/DSCF0001.RAF'],
        ['RAW', 'JPEG'],
      ),
    ).toBe(2);
  });

  it('normalises Windows separators', () => {
    expect(frameKey('RAW\\GFX\\DSCF0001.RAF', ['RAW'])).toBe('gfx/dscf0001');
  });

  it('is unknown, not zero, for a missing folder', () => {
    expect(countFrames(null)).toBeNull();
    expect(countFrames([])).toBe(0);
  });
});

describe('reconcileCounts (P7)', () => {
  it('keeps consistent counts', () => {
    const counts = { photoCount: 200, selectedCount: 40, editedCount: 30 };
    expect(reconcileCounts(counts)).toEqual(counts);
  });

  it('treats a skipped selection as unknown', () => {
    expect(
      reconcileCounts({ photoCount: 200, selectedCount: 0, editedCount: 12 }),
    ).toEqual({ photoCount: 200, selectedCount: null, editedCount: 12 });
  });

  it('treats a source smaller than its selects as unknown', () => {
    expect(
      reconcileCounts({ photoCount: 0, selectedCount: 15, editedCount: 3 }),
    ).toEqual({ photoCount: null, selectedCount: 15, editedCount: 3 });
  });

  it('compares the source with exports when selects are unknown', () => {
    expect(
      reconcileCounts({ photoCount: 5, selectedCount: null, editedCount: 9 }),
    ).toEqual({ photoCount: null, selectedCount: null, editedCount: 9 });
  });
});

describe('scanMayOverwrite', () => {
  const reportedAt = new Date('2026-10-02T14:00:00Z');
  const reported = {
    countsSource: PhotoEntryCountsSource.REPORTED,
    countsUpdatedAt: reportedAt,
  };

  it('keeps counts reported after the folders last changed', () => {
    expect(scanMayOverwrite(reported, new Date('2026-10-02T13:00:00Z'))).toBe(
      false,
    );
  });

  it('takes over once the folders change again', () => {
    expect(scanMayOverwrite(reported, new Date('2026-10-02T15:00:00Z'))).toBe(
      true,
    );
  });

  it('always refreshes its own earlier scan or empty counts', () => {
    expect(
      scanMayOverwrite(
        {
          countsSource: PhotoEntryCountsSource.SCANNED,
          countsUpdatedAt: reportedAt,
        },
        null,
      ),
    ).toBe(true);
    expect(
      scanMayOverwrite({ countsSource: null, countsUpdatedAt: null }, null),
    ).toBe(true);
  });
});
