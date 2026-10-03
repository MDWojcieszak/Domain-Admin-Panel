import { mkdtempSync, readdirSync, readFileSync, rmSync, utimesSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import * as sharp from 'sharp';

import { PreviewSize } from './export-files';
import { PreviewCacheService } from './preview-cache.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

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

  it('generates an upright webp of the requested size', async () => {
    const path = await service.get(source, 'ab12.webp', PreviewSize.THUMB);
    const meta = await sharp(readFileSync(path)).metadata();
    expect(meta.format).toBe('webp');
    expect([meta.width, meta.height]).toEqual([320, 480]);
  });

  it('generates once for concurrent requests of the same preview', async () => {
    const spy = jest.spyOn(service as any, 'generate');
    const paths = await Promise.all(
      Array.from({ length: 5 }, () =>
        service.get(source, 'cd34.webp', PreviewSize.THUMB),
      ),
    );
    expect(new Set(paths).size).toBe(1);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('drops previews nobody looked at for a month', async () => {
    const fresh = await service.get(source, 'ef56.webp', PreviewSize.THUMB);
    const stale = await service.get(source, 'ff78.webp', PreviewSize.THUMB);
    const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    utimesSync(stale, old, old);

    await service.cleanup();

    const left = readdirSync(join(dir, 'cache'), { recursive: true }).map(
      String,
    );
    expect(left.some((p) => p.endsWith('ef56.webp'))).toBe(true);
    expect(left.some((p) => p.endsWith('ff78.webp'))).toBe(false);
    expect(fresh).toBeTruthy();
  });
});
