import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import * as sharp from 'sharp';

import { PreviewSize } from './export-files';
import { PreviewCacheService } from './preview-cache.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

const ENTRY = '11111111-2222-4333-8444-555555555555';

describe('PreviewCacheService', () => {
  let dir: string;
  let source: string;
  let service: PreviewCacheService;

  beforeEach(async () => {
    sharp.cache(false); // Windows: do not keep handles on files we delete
    dir = mkdtempSync(join(tmpdir(), 'previews-'));
    source = join(dir, 'export.jpg');
    await sharp({
      create: { width: 3000, height: 2000, channels: 3, background: '#a33' },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toFile(source);
    service = new PreviewCacheService({
      get: () => join(dir, 'cache'),
    } as any);
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('generates an upright webp of the requested size, per entry', async () => {
    const path = await service.get(
      ENTRY,
      source,
      'ab12.webp',
      PreviewSize.THUMB,
    );
    expect(path).toBe(join(dir, 'cache', ENTRY, 'ab12.webp'));
    const meta = await sharp(readFileSync(path)).metadata();
    expect(meta.format).toBe('webp');
    expect([meta.width, meta.height]).toEqual([320, 480]);
  });

  it('generates once for concurrent requests of the same preview', async () => {
    const spy = jest.spyOn(service as any, 'generate');
    const paths = await Promise.all(
      Array.from({ length: 5 }, () =>
        service.get(ENTRY, source, 'cd34.webp', PreviewSize.THUMB),
      ),
    );
    expect(new Set(paths).size).toBe(1);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('keeps a preview however long nobody looked at it', async () => {
    const path = await service.get(
      ENTRY,
      source,
      'ef56.webp',
      PreviewSize.THUMB,
    );
    const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    utimesSync(path, yearAgo, yearAgo);

    const spy = jest.spyOn(service as any, 'generate');
    expect(
      await service.get(ENTRY, source, 'ef56.webp', PreviewSize.THUMB),
    ).toBe(path);
    expect(spy).not.toHaveBeenCalled();
  });

  it('prunes only what is not kept', async () => {
    await service.get(ENTRY, source, 'keep.webp', PreviewSize.THUMB);
    await service.get(ENTRY, source, 'stale.webp', PreviewSize.THUMB);

    expect(await service.prune(ENTRY, new Set(['keep.webp']))).toBe(1);
    expect(readdirSync(join(dir, 'cache', ENTRY))).toEqual(['keep.webp']);
  });

  it('drops leftovers that are not entry directories', async () => {
    mkdirSync(join(dir, 'cache', 'ab'), { recursive: true });
    writeFileSync(join(dir, 'cache', 'ab', 'old.webp'), 'x');
    await service.get(ENTRY, source, 'keep.webp', PreviewSize.THUMB);

    expect(await service.dropLeftovers()).toBe(1);
    expect(existsSync(join(dir, 'cache', ENTRY, 'keep.webp'))).toBe(true);
    expect(await service.cachedEntries()).toEqual([ENTRY]);
  });
});
