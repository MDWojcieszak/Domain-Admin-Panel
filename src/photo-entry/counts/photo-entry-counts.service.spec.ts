import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import {
  PhotoEntryCountsSource,
  PhotoEntryStatus,
  PhotoEntryType,
} from '@prisma/client';

import { PhotoStorageService } from '../../photo-storage-service/photo-storage.service';
import { PhotoEntryCountsService } from './photo-entry-counts.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

const ROOT = '2026/2026-10-12_Eclipse';

function makeLibrary(files: string[]): string {
  const library = mkdtempSync(join(tmpdir(), 'photo-lib-'));
  for (const file of files) {
    const path = join(library, ROOT, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, '');
  }
  return library;
}

const entry = (over: Record<string, any> = {}) => ({
  id: 'pe1',
  userId: 'u1',
  type: PhotoEntryType.GENERAL,
  status: PhotoEntryStatus.SHOT,
  rootPath: ROOT,
  foldersCreated: true,
  photoCount: null,
  selectedCount: null,
  editedCount: null,
  countsSource: null,
  countsUpdatedAt: null,
  ...over,
});

function makeService(library: string, stored = entry()) {
  const prisma: any = {
    photoEntry: {
      findFirst: jest.fn().mockResolvedValue(stored),
      findUnique: jest.fn().mockResolvedValue(stored),
      update: jest.fn(({ data }: any) =>
        Promise.resolve({ ...stored, ...data }),
      ),
    },
  };
  const storage = new PhotoStorageService({
    get: (key: string) => (key === 'PHOTO_LIBRARY_PATH' ? library : ''),
  } as any);
  return { service: new PhotoEntryCountsService(prisma, storage), prisma };
}

describe('PhotoEntryCountsService', () => {
  const libraries: string[] = [];
  const library = (files: string[]) => {
    const path = makeLibrary(files);
    libraries.push(path);
    return path;
  };
  afterAll(() =>
    libraries.forEach((l) => rmSync(l, { recursive: true, force: true })),
  );

  it('counts frames per stage from the folder structure', async () => {
    const lib = library([
      '01_SOURCE/RAW/GFX/DSCF0001.RAF',
      '01_SOURCE/JPEG/GFX/DSCF0001.JPG', // same frame as the RAF
      '01_SOURCE/RAW/GFX/DSCF0001.RAF.xmp', // sidecar
      '01_SOURCE/RAW/X-T5/DSCF0001.RAF', // other body, same name
      '01_SOURCE/RAW/X-T5/DSCF0002.RAF',
      '01_SOURCE/RAW/@eaDir/DSCF0001.RAF/SYNOPHOTO_THUMB_M.jpg', // NAS cache
      '01_SOURCE/VIDEO/DSCF0003.MOV',
      '01_SOURCE/SEQUENCES/tl/0001.JPG', // timelapse is not the shoot
      '02_SELECTS/DSCF0001.RAF',
      '02_SELECTS/DSCF0002.RAF',
      '04_EXPORT/DSCF0001.jpg',
    ]);
    const { service } = makeService(lib);

    const { counts, foldersChangedAt } = await service.scan(entry());

    expect(counts).toEqual({
      photoCount: 3,
      selectedCount: 2,
      editedCount: 1,
    });
    expect(foldersChangedAt?.getTime()).toEqual(expect.any(Number));
  });

  it('reports a missing stage folder as unknown', async () => {
    const lib = library(['01_SOURCE/RAW/DSCF0001.RAF']);
    const { service } = makeService(lib);

    expect((await service.scan(entry())).counts).toEqual({
      photoCount: 1,
      selectedCount: null,
      editedCount: null,
    });
  });

  it('applies an explicit refresh and marks the counts SCANNED', async () => {
    const lib = library(['01_SOURCE/RAW/DSCF0001.RAF']);
    const { service, prisma } = makeService(lib);

    const res = await service.refresh('u1', 'pe1');

    expect(prisma.photoEntry.update.mock.calls[0][0].data).toMatchObject({
      photoCount: 1,
      countsSource: PhotoEntryCountsSource.SCANNED,
    });
    expect(res.countsSource).toBe(PhotoEntryCountsSource.SCANNED);
  });

  it('refuses ASTRO entries, which have no single root', async () => {
    const { service } = makeService(
      library([]),
      entry({ type: PhotoEntryType.ASTRO }),
    );
    await expect(service.refresh('u1', 'pe1')).rejects.toThrow(/ASTRO/);
  });

  it('keeps counts the culling app reported after the folders changed', async () => {
    const lib = library(['01_SOURCE/RAW/DSCF0001.RAF']);
    const past = new Date('2026-01-01T00:00:00Z');
    for (const dir of ['01_SOURCE', '01_SOURCE/RAW']) {
      utimesSync(join(lib, ROOT, dir), past, past);
    }
    const { service, prisma } = makeService(
      lib,
      entry({
        photoCount: 200,
        countsSource: PhotoEntryCountsSource.REPORTED,
        countsUpdatedAt: new Date('2026-06-01T00:00:00Z'),
      }),
    );

    expect(await service.refreshAutomatically('pe1')).toBeNull();
    expect(prisma.photoEntry.update).not.toHaveBeenCalled();
  });

  it('takes over once the folders change after the report', async () => {
    const lib = library(['01_SOURCE/RAW/DSCF0001.RAF']);
    const { service, prisma } = makeService(
      lib,
      entry({
        photoCount: 200,
        countsSource: PhotoEntryCountsSource.REPORTED,
        countsUpdatedAt: new Date('2026-01-01T00:00:00Z'),
      }),
    );

    expect(await service.refreshAutomatically('pe1')).not.toBeNull();
    expect(prisma.photoEntry.update.mock.calls[0][0].data.photoCount).toBe(1);
  });

  it('never throws from an automatic run, e.g. when the mount is gone', async () => {
    const { service } = makeService('/nonexistent/library');
    expect(await service.refreshAutomatically('pe1')).toBeNull();
  });
});
