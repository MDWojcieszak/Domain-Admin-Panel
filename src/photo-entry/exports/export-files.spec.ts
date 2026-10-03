import { join } from 'path';
import { PublicationStatus } from '@prisma/client';

import {
  classifyExportFile,
  decodeKey,
  encodeKey,
  ExportFileStatus,
  exportFileStatus,
  isInside,
  previewCacheName,
  PreviewSize,
  publishAction,
  signPreview,
  verifyPreview,
} from './export-files';

describe('classifyExportFile', () => {
  it('publishes rendered formats', () => {
    expect(classifyExportFile('DSCF0412.jpg')).toEqual({
      format: 'jpeg',
      publishable: true,
      reason: null,
    });
    expect(classifyExportFile('pano.TIF')?.format).toBe('tiff');
  });

  it('lists RAW and HEIC but refuses to publish them', () => {
    expect(classifyExportFile('DSCF0412.RAF')).toMatchObject({
      format: 'raw',
      publishable: false,
    });
    expect(classifyExportFile('IMG_1.HEIC')).toMatchObject({
      format: 'heif',
      publishable: false,
    });
  });

  it('hides sidecars, videos and dotfiles', () => {
    expect(classifyExportFile('DSCF0412.jpg.xmp')).toBeNull();
    expect(classifyExportFile('clip.mov')).toBeNull();
    expect(classifyExportFile('._DSCF0412.jpg')).toBeNull();
  });
});

describe('keys (Q2)', () => {
  it('round-trips a relative path', () => {
    const path = 'web/Zakopane — świt/DSCF0412.jpg';
    expect(decodeKey(encodeKey(path))).toBe(path);
  });

  it('rejects anything that could escape the folder', () => {
    for (const evil of [
      '../secret.jpg',
      'a/../../etc/passwd',
      '/etc/passwd',
      'C:/Windows/win.ini',
      'a\\..\\b.jpg',
      'a//b.jpg',
      './a.jpg',
      'a.jpg\0.png',
    ]) {
      expect(decodeKey(encodeKey(evil))).toBeNull();
    }
    expect(decodeKey('not base64url!')).toBeNull();
  });
});

describe('isInside', () => {
  const root = join('/lib', 'entry', '04_EXPORT');

  it('accepts files below the root', () => {
    expect(isInside(root, join(root, 'web', 'a.jpg'))).toBe(true);
  });

  it('refuses the root itself, siblings and parents', () => {
    expect(isInside(root, root)).toBe(false);
    expect(isInside(root, join('/lib', 'entry', '03_EDIT', 'a.jpg'))).toBe(
      false,
    );
    expect(
      isInside(root, join('/lib', 'entry', '04_EXPORT-evil', 'a.jpg')),
    ).toBe(false);
  });
});

describe('signed preview URLs (Q3)', () => {
  const secret = 's3cret';
  const now = 1_800_000_000;
  const args = {
    entryId: 'pe1',
    key: encodeKey('a.jpg'),
    size: PreviewSize.THUMB,
    exp: now + 60,
  };
  const sig = signPreview(secret, args.entryId, args.key, args.size, args.exp);

  it('verifies a fresh signature', () => {
    expect(verifyPreview(secret, { ...args, sig }, now)).toBe(true);
  });

  it('refuses an expired one', () => {
    expect(verifyPreview(secret, { ...args, sig }, now + 61)).toBe(false);
  });

  it('cannot be reused for another file, size or entry', () => {
    expect(
      verifyPreview(secret, { ...args, key: encodeKey('b.jpg'), sig }, now),
    ).toBe(false);
    expect(
      verifyPreview(secret, { ...args, size: PreviewSize.PREVIEW, sig }, now),
    ).toBe(false);
    expect(verifyPreview(secret, { ...args, entryId: 'pe2', sig }, now)).toBe(
      false,
    );
    expect(verifyPreview('other', { ...args, sig }, now)).toBe(false);
  });
});

describe('previewCacheName', () => {
  it('changes when the file is re-exported', () => {
    const a = previewCacheName('pe1', 'a.jpg', 100, 1000, PreviewSize.THUMB);
    expect(previewCacheName('pe1', 'a.jpg', 100, 1000, PreviewSize.THUMB)).toBe(
      a,
    );
    expect(
      previewCacheName('pe1', 'a.jpg', 101, 1000, PreviewSize.THUMB),
    ).not.toBe(a);
    expect(
      previewCacheName('pe1', 'a.jpg', 100, 2000, PreviewSize.THUMB),
    ).not.toBe(a);
    expect(
      previewCacheName('pe1', 'a.jpg', 100, 1000, PreviewSize.PREVIEW),
    ).not.toBe(a);
  });
});

describe('exportFileStatus / publishAction (Q4)', () => {
  const file = { size: 100, mtime: new Date('2026-10-01T10:00:00Z') };
  const published = {
    status: PublicationStatus.PUBLISHED,
    imageId: 'img',
    sourceSize: BigInt(100),
    sourceMtime: new Date('2026-10-01T10:00:00Z'),
  };

  it('derives every state', () => {
    expect(exportFileStatus(null, file)).toBe(ExportFileStatus.NEW);
    expect(exportFileStatus(published, file)).toBe(ExportFileStatus.PUBLISHED);
    expect(exportFileStatus(published, { ...file, size: 120 })).toBe(
      ExportFileStatus.CHANGED,
    );
    expect(exportFileStatus({ ...published, imageId: null }, file)).toBe(
      ExportFileStatus.NEW,
    );
    expect(
      exportFileStatus(
        { ...published, status: PublicationStatus.PENDING },
        file,
      ),
    ).toBe(ExportFileStatus.PENDING);
  });

  it('never duplicates an image', () => {
    expect(publishAction(ExportFileStatus.NEW, false)).toBe('upload');
    expect(publishAction(ExportFileStatus.CHANGED, true)).toBe('replace');
    expect(publishAction(ExportFileStatus.PUBLISHED, true)).toBe('skip');
    expect(publishAction(ExportFileStatus.PENDING, false)).toBe('skip');
    // a failed replace still owns its image
    expect(publishAction(ExportFileStatus.FAILED, true)).toBe('replace');
    expect(publishAction(ExportFileStatus.FAILED, false)).toBe('upload');
  });
});
