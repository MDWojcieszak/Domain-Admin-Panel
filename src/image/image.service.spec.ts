import * as fs from 'fs';

import { ImageService } from './image.service';
import { ImageSizeType } from './dto';

/* eslint-disable @typescript-eslint/no-explicit-any */

function makeService() {
  const prisma = {
    image: { findUnique: jest.fn() },
  };
  const service = new ImageService(prisma as any, {} as any);
  return { service, prisma };
}

describe('ImageService', () => {
  describe('readImage', () => {
    afterEach(() => jest.restoreAllMocks());

    it('404s on an unknown image id instead of a misleading 403', async () => {
      const { service, prisma } = makeService();
      prisma.image.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.readImage('nope', ImageSizeType.COVER),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('403s when the record exists but the file is gone', async () => {
      const { service, prisma } = makeService();
      prisma.image.findUnique.mockResolvedValueOnce({ coverUrl: '/x/cover' });
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);

      await expect(
        service.readImage('i1', ImageSizeType.COVER),
      ).rejects.toMatchObject({ status: 403 });
    });

    it('streams the requested size when it exists', async () => {
      const { service, prisma } = makeService();
      prisma.image.findUnique.mockResolvedValueOnce({
        originalUrl: '/x/orig',
        coverUrl: '/x/cover',
        lowResUrl: '/x/low',
      });
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      const stream = {} as fs.ReadStream;
      const create = jest.spyOn(fs, 'createReadStream').mockReturnValue(stream);

      await expect(
        service.readImage('i1', ImageSizeType.ORIGINAL),
      ).resolves.toBe(stream);
      expect(create).toHaveBeenCalledWith('/x/orig');
    });

    it('serves the thumb, or the cover for images without one yet', async () => {
      const { service, prisma } = makeService();
      jest
        .spyOn(fs, 'existsSync')
        .mockImplementation((p) => p !== '/x/missing');
      const create = jest
        .spyOn(fs, 'createReadStream')
        .mockReturnValue({} as fs.ReadStream);

      prisma.image.findUnique.mockResolvedValueOnce({
        coverUrl: '/x/cover',
        thumbUrl: '/x/thumb',
      });
      await service.readImage('i1', ImageSizeType.THUMB);
      expect(create).toHaveBeenLastCalledWith('/x/thumb');

      // processed before thumbs existed
      prisma.image.findUnique.mockResolvedValueOnce({
        coverUrl: '/x/cover',
        thumbUrl: null,
      });
      await service.readImage('i1', ImageSizeType.THUMB);
      expect(create).toHaveBeenLastCalledWith('/x/cover');

      // row says it has one, the file is gone
      prisma.image.findUnique.mockResolvedValueOnce({
        coverUrl: '/x/cover',
        thumbUrl: '/x/missing',
      });
      await service.readImage('i1', ImageSizeType.THUMB);
      expect(create).toHaveBeenLastCalledWith('/x/cover');
    });

    it('reports a DB outage as 500, not as 403', async () => {
      const { service, prisma } = makeService();
      prisma.image.findUnique.mockRejectedValueOnce(new Error('db down'));

      await expect(
        service.readImage('i1', ImageSizeType.COVER),
      ).rejects.toMatchObject({ status: 500 });
    });
  });
});
