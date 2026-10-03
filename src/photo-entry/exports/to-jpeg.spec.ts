import * as sharp from 'sharp';

import { toJpeg } from './export.service';

describe('toJpeg (D3)', () => {
  it('flattens transparency onto white instead of black', async () => {
    const transparentPng = await sharp({
      create: {
        width: 4,
        height: 4,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toBuffer();

    const jpeg = await toJpeg(transparentPng);
    const { data, info } = await sharp(jpeg).raw().toBuffer({
      resolveWithObject: true,
    });

    expect(info.format).toBe('raw');
    expect(info.channels).toBe(3);
    expect([data[0], data[1], data[2]].every((v) => v > 245)).toBe(true);
  });

  it('produces a JPEG', async () => {
    const png = await sharp({
      create: { width: 4, height: 4, channels: 3, background: '#c33' },
    })
      .png()
      .toBuffer();
    expect((await sharp(await toJpeg(png)).metadata()).format).toBe('jpeg');
  });
});
