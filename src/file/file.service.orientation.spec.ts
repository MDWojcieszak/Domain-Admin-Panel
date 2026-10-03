import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import * as sharp from 'sharp';

import { FileService } from './file.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('FileService — EXIF orientation', () => {
  const service = new FileService({} as any);
  const portraitShotSideways = () =>
    sharp({
      create: { width: 600, height: 400, channels: 3, background: '#888' },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

  it('reports the displayed size of a rotated photo', async () => {
    expect(await service.getImageSize(await portraitShotSideways())).toEqual({
      width: 400,
      height: 600,
    });
  });

  it('writes covers upright', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cover-'));
    try {
      const out = join(dir, 'cover.webp');
      await service.saveWebp(await portraitShotSideways(), out, 1920, 80);
      const meta = await sharp(readFileSync(out)).metadata();
      expect([meta.width, meta.height]).toEqual([400, 600]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
