import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { PhotoEntryType } from '@prisma/client';
import * as sharp from 'sharp';

import { PhotoStorageService } from '../../photo-storage-service/photo-storage.service';
import { PreviewSize } from './export-files';
import { ExportService } from './export.service';
import { PreviewCacheService } from './preview-cache.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

const ENTRY = '11111111-2222-4333-8444-555555555555';
const GONE = '99999999-2222-4333-8444-555555555555';
const ROOT = '2026/prune';

describe('ExportService.prunePreviews', () => {
  let base: string;
  let library: string;
  let cache: string;
  let previews: PreviewCacheService;
  let service: ExportService;
  let entry: any;

  const writeJpeg = (rel: string, color: string) =>
    sharp({
      create: { width: 600, height: 400, channels: 3, background: color },
    })
      .jpeg()
      .toFile(join(library, ROOT, '04_EXPORT', rel));

  const scanThenPreviewAll = async () => {
    const scan = await service.scan('u1', ENTRY);
    for (const f of scan.files.filter((x) => x.publishable)) {
      const q = Object.fromEntries(
        new URL('http://x' + f.thumbUrl).searchParams,
      ) as any;
      await service.preview(ENTRY, { ...q, exp: Number(q.exp) });
    }
  };

  beforeEach(async () => {
    sharp.cache(false);
    base = mkdtempSync(join(tmpdir(), 'prune-'));
    library = join(base, 'lib');
    cache = join(base, 'cache');
    mkdirSync(join(library, ROOT, '04_EXPORT'), { recursive: true });
    await writeJpeg('a.jpg', '#a33');
    await writeJpeg('b.jpg', '#3a3');

    const env: Record<string, string> = {
      PHOTO_LIBRARY_PATH: library,
      EXPORT_PREVIEW_CACHE_PATH: cache,
      JWT_SECRET: 'test-secret',
    };
    const config = { get: (k: string) => env[k] } as any;
    entry = {
      id: ENTRY,
      userId: 'u1',
      type: PhotoEntryType.GENERAL,
      rootPath: ROOT,
      foldersCreated: true,
    };
    const prisma: any = {
      photoEntry: {
        findFirst: jest.fn().mockImplementation(() => entry),
        findUnique: jest
          .fn()
          .mockImplementation(({ where }: any) =>
            where.id === ENTRY ? entry : null,
          ),
      },
      photoEntryPublication: { findMany: jest.fn().mockResolvedValue([]) },
    };
    previews = new PreviewCacheService(config);
    service = new ExportService(
      prisma,
      new PhotoStorageService(config),
      previews,
      {} as any,
      {} as any,
      config,
    );
    await scanThenPreviewAll();
  });

  afterEach(() => rmSync(base, { recursive: true, force: true }));

  const cached = () => readdirSync(join(cache, ENTRY)).sort();

  it('keeps every preview of files still in the export', async () => {
    const before = cached();
    expect(before).toHaveLength(2);
    await service.prunePreviews();
    expect(cached()).toEqual(before);
  });

  it('drops the old version of a re-exported file and of a removed one', async () => {
    const before = cached();
    await new Promise((r) => setTimeout(r, 20));
    await writeJpeg('a.jpg', '#33a'); // re-export
    rmSync(join(library, ROOT, '04_EXPORT', 'b.jpg')); // removed
    await scanThenPreviewAll(); // new version of a.jpg gets a preview

    await service.prunePreviews();

    const after = cached();
    expect(after).toHaveLength(1);
    expect(before).not.toContain(after[0]);
  });

  it('keeps everything when the export folder cannot be read', async () => {
    const before = cached();
    rmSync(join(library, ROOT), { recursive: true, force: true }); // share gone
    await service.prunePreviews();
    expect(cached()).toEqual(before);
  });

  it('drops the directory of an entry that no longer exists', async () => {
    mkdirSync(join(cache, GONE));
    writeFileSync(join(cache, GONE, 'x.webp'), 'x');
    await service.prunePreviews();
    expect(existsSync(join(cache, GONE))).toBe(false);
    expect(existsSync(join(cache, ENTRY))).toBe(true);
  });

  it('caches both sizes under the entry', async () => {
    const scan = await service.scan('u1', ENTRY);
    const q = Object.fromEntries(
      new URL('http://x' + scan.files[0].previewUrl).searchParams,
    ) as any;
    await service.preview(ENTRY, {
      ...q,
      exp: Number(q.exp),
      size: PreviewSize.PREVIEW,
    });
    expect(cached()).toHaveLength(3);
  });
});
