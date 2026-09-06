import * as fs from 'fs';

import { GalleryImageRole, GalleryStatus, ImageScope } from '@prisma/client';

import { GalleryService } from './gallery.service';
import { PHOTO_SIZE } from './dto';

/* eslint-disable @typescript-eslint/no-explicit-any */

function makeService() {
  const prisma = {
    image: { findMany: jest.fn(), findUnique: jest.fn() },
  };
  const service = new GalleryService(prisma as any);
  return { service, prisma };
}

const image = {
  id: 'i1',
  dimensions: { width: '4000', height: '3000' },
  data: {
    title: 'Tatry',
    dateTaken: new Date('2026-05-01'),
    localization: 'Zakopane',
    description: null,
  },
};

describe('GalleryService (legacy)', () => {
  describe('getAll', () => {
    it('returns the legacy { images, count } shape', async () => {
      const { service, prisma } = makeService();
      prisma.image.findMany.mockResolvedValueOnce([image]);

      const result = await service.getAll();

      expect(result).toEqual({ images: [image], count: 1 });
    });

    it('only exposes images published through a gallery', async () => {
      const { service, prisma } = makeService();
      prisma.image.findMany.mockResolvedValueOnce([]);

      await service.getAll();

      const where = prisma.image.findMany.mock.calls[0][0].where;
      expect(where.scope).toBe(ImageScope.GALLERY);
      expect(where.galleryItems.some).toEqual({
        role: { not: GalleryImageRole.HIDDEN },
        gallery: { status: GalleryStatus.PUBLISHED },
      });
    });

    it('selects exactly the legacy fields — no EXIF / processing leakage', async () => {
      const { service, prisma } = makeService();
      prisma.image.findMany.mockResolvedValueOnce([]);

      await service.getAll();

      const select = prisma.image.findMany.mock.calls[0][0].select;
      expect(Object.keys(select).sort()).toEqual(['data', 'dimensions', 'id']);
      expect(Object.keys(select.data.select).sort()).toEqual([
        'dateTaken',
        'description',
        'localization',
        'title',
      ]);
    });

    it('maps query failures to 422, as before', async () => {
      const { service, prisma } = makeService();
      prisma.image.findMany.mockRejectedValueOnce(new Error('db down'));

      await expect(service.getAll()).rejects.toMatchObject({ status: 422 });
    });
  });

  describe('readImage', () => {
    afterEach(() => jest.restoreAllMocks());

    it('404s on an unknown image id', async () => {
      const { service, prisma } = makeService();
      prisma.image.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.readImage('nope', PHOTO_SIZE.COVER),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('403s when the record exists but the file is gone', async () => {
      const { service, prisma } = makeService();
      prisma.image.findUnique.mockResolvedValueOnce({ coverUrl: '/x/cover' });
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);

      await expect(
        service.readImage('i1', PHOTO_SIZE.COVER),
      ).rejects.toMatchObject({ status: 403 });
    });

    it('streams the low-res file when it exists', async () => {
      const { service, prisma } = makeService();
      prisma.image.findUnique.mockResolvedValueOnce({ lowResUrl: '/x/low' });
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      const stream = {} as fs.ReadStream;
      const create = jest.spyOn(fs, 'createReadStream').mockReturnValue(stream);

      await expect(service.readImage('i1', PHOTO_SIZE.LOW_RES)).resolves.toBe(
        stream,
      );
      expect(create).toHaveBeenCalledWith('/x/low');
    });

    it('still 500s on a genuine failure', async () => {
      const { service, prisma } = makeService();
      prisma.image.findUnique.mockRejectedValueOnce(new Error('db down'));

      await expect(
        service.readImage('i1', PHOTO_SIZE.COVER),
      ).rejects.toMatchObject({ status: 500 });
    });
  });
});
