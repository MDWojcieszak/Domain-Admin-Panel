import { GalleryImageRole, GalleryStatus } from '@prisma/client';

import { GalleriesService } from './galleries.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

function makeService() {
  const prisma = {
    gallery: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    galleryImage: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    image: { count: jest.fn(), findMany: jest.fn() },
    heroImage: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn((arg: any) =>
      typeof arg === 'function' ? arg({}) : Promise.all(arg),
    ),
  };
  const service = new GalleriesService(prisma as any);
  return { service, prisma };
}

const detail = {
  id: 'g1',
  title: 'G',
  slug: 'g',
  description: null,
  status: GalleryStatus.DRAFT,
  sortOrder: 0,
  coverImageId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  publishedAt: null,
  _count: { items: 0 },
  items: [],
};

describe('GalleriesService', () => {
  describe('create', () => {
    it('derives a unique slug and starts at next sortOrder', async () => {
      const { service, prisma } = makeService();
      prisma.gallery.findUnique.mockResolvedValueOnce(null); // slug free
      prisma.gallery.findFirst.mockResolvedValueOnce({ sortOrder: 4 });
      prisma.gallery.create.mockResolvedValueOnce({
        ...detail,
        title: 'Komunie 2026',
        slug: 'komunie-2026',
        sortOrder: 5,
      });

      const res = await service.create('u1', { title: 'Komunie 2026' } as any);

      expect(prisma.gallery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            slug: 'komunie-2026',
            sortOrder: 5,
            createdById: 'u1',
          }),
        }),
      );
      expect(res.slug).toBe('komunie-2026');
    });

    it('de-collides slug with a numeric suffix', async () => {
      const { service, prisma } = makeService();
      prisma.gallery.findUnique
        .mockResolvedValueOnce({ id: 'other' }) // 'komunie' taken
        .mockResolvedValueOnce(null); // 'komunie-2' free
      prisma.gallery.findFirst.mockResolvedValueOnce(null);
      prisma.gallery.create.mockResolvedValueOnce({ ...detail });

      await service.create('u1', { title: 'Komunie' } as any);

      const data = prisma.gallery.create.mock.calls[0][0].data;
      expect(data.slug).toBe('komunie-2');
    });
  });

  describe('setItems', () => {
    it('validates scope, dedupes, and replaces in a transaction', async () => {
      const { service, prisma } = makeService();
      prisma.gallery.findUnique.mockResolvedValue({ id: 'g1' }); // getOrThrow + getById
      prisma.image.count.mockResolvedValue(2); // 2 unique valid gallery images
      prisma.gallery.findUnique.mockResolvedValueOnce({ id: 'g1' }); // getOrThrow
      // getById at the end:
      prisma.gallery.findUnique.mockResolvedValue(detail);

      await service.setItems('g1', {
        items: [
          { imageId: 'a', order: 0, role: GalleryImageRole.HERO },
          { imageId: 'b', order: 1 },
          { imageId: 'a', order: 2 }, // duplicate imageId — last wins
        ],
      } as any);

      expect(prisma.galleryImage.deleteMany).toHaveBeenCalledWith({
        where: { galleryId: 'g1' },
      });
      const created = prisma.galleryImage.createMany.mock.calls[0][0].data;
      // deduped to 2 unique images
      expect(created).toHaveLength(2);
      expect(created.find((i: any) => i.imageId === 'a').order).toBe(2);
      expect(created.find((i: any) => i.imageId === 'b').role).toBe(
        GalleryImageRole.NORMAL,
      );
    });

    it('rejects when an image is not a gallery image', async () => {
      const { service, prisma } = makeService();
      prisma.gallery.findUnique.mockResolvedValue({ id: 'g1' });
      prisma.image.count.mockResolvedValue(0); // none valid

      await expect(
        service.setItems('g1', {
          items: [{ imageId: 'x', order: 0 }],
        } as any),
      ).rejects.toThrow(/gallery images/);
    });
  });

  describe('patchStatus', () => {
    it('stamps publishedAt on first publish', async () => {
      const { service, prisma } = makeService();
      prisma.gallery.findUnique.mockResolvedValue({
        id: 'g1',
        publishedAt: null,
      });
      prisma.gallery.update.mockResolvedValue({ ...detail });

      await service.patchStatus('g1', { status: GalleryStatus.PUBLISHED });

      const data = prisma.gallery.update.mock.calls[0][0].data;
      expect(data.status).toBe(GalleryStatus.PUBLISHED);
      expect(data.publishedAt).toBeInstanceOf(Date);
    });

    it('does not re-stamp publishedAt if already set', async () => {
      const { service, prisma } = makeService();
      prisma.gallery.findUnique.mockResolvedValue({
        id: 'g1',
        publishedAt: new Date('2020-01-01'),
      });
      prisma.gallery.update.mockResolvedValue({ ...detail });

      await service.patchStatus('g1', { status: GalleryStatus.PUBLISHED });

      const data = prisma.gallery.update.mock.calls[0][0].data;
      expect(data.publishedAt).toBeUndefined();
    });
  });

  describe('listPublished', () => {
    it('merges visible counts and builds cover urls', async () => {
      const { service, prisma } = makeService();
      prisma.gallery.findMany.mockResolvedValue([
        {
          id: 'g1',
          title: 'A',
          slug: 'a',
          description: null,
          coverImageId: 'img1',
        },
        {
          id: 'g2',
          title: 'B',
          slug: 'b',
          description: null,
          coverImageId: null,
        },
      ]);
      prisma.galleryImage.groupBy.mockResolvedValue([
        { galleryId: 'g1', _count: 7 },
      ]);

      const res = await service.listPublished();

      expect(res.total).toBe(2);
      const a = res.galleries.find((g) => g.id === 'g1')!;
      expect(a.imageCount).toBe(7);
      expect(a.coverUrl).toBe('/image/cover?id=img1');
      const b = res.galleries.find((g) => g.id === 'g2')!;
      expect(b.imageCount).toBe(0); // no group row
      expect(b.coverUrl).toBeNull();
    });
  });

  describe('getPublishedBySlug', () => {
    it('404s when the gallery is not published / missing', async () => {
      const { service, prisma } = makeService();
      prisma.gallery.findFirst.mockResolvedValue(null);

      await expect(service.getPublishedBySlug('nope')).rejects.toThrow(
        /not found/i,
      );
    });

    it('returns visible items mapped to public shape', async () => {
      const { service, prisma } = makeService();
      prisma.gallery.findFirst.mockResolvedValue({
        id: 'g1',
        title: 'A',
        slug: 'a',
        description: null,
        coverImageId: null,
      });
      prisma.galleryImage.findMany.mockResolvedValue([
        {
          imageId: 'img1',
          order: 0,
          role: GalleryImageRole.HERO,
          image: {
            width: 1600,
            height: 900,
            orientation: 'LANDSCAPE',
            cameraMake: 'FUJIFILM',
            cameraModel: 'X-T5',
            lens: 'XF35mmF2 R WR',
            focalLength: 35,
            fNumber: 2,
            iso: 200,
            exposureTime: '1/250',
            takenAt: new Date('2026-01-31T14:20:00.000Z'),
            data: { localization: 'Kraków' },
          },
        },
      ]);

      const res = await service.getPublishedBySlug('a');

      expect(res.items).toHaveLength(1);
      expect(res.items[0]).toMatchObject({
        imageId: 'img1',
        role: GalleryImageRole.HERO,
        coverUrl: '/image/cover?id=img1',
        lowResUrl: '/image/low-res?id=img1',
        width: 1600,
        orientation: 'LANDSCAPE',
        localization: 'Kraków',
      });
      expect(res.items[0].exif).toMatchObject({
        cameraModel: 'X-T5',
        focalLength: 35,
        fNumber: 2,
        iso: 200,
        exposureTime: '1/250',
      });
    });
  });

  describe('library', () => {
    it('lists gallery images with usage count and paging', async () => {
      const { service, prisma } = makeService();
      prisma.image.findMany.mockResolvedValue([
        {
          id: 'i1',
          width: 1600,
          height: 900,
          orientation: 'LANDSCAPE',
          processingStatus: 'DONE',
          cameraModel: 'X-T5',
          fNumber: 2,
          data: { localization: 'Kraków' },
          _count: { galleryItems: 2 },
        },
      ]);
      prisma.image.count.mockResolvedValue(5);

      const res = await service.library(40, 0, false);

      const where = prisma.image.findMany.mock.calls[0][0].where;
      expect(where.scope).toBe('GALLERY');
      expect(where.galleryItems).toBeUndefined(); // not filtered
      expect(res.total).toBe(5);
      expect(res.images[0]).toMatchObject({
        imageId: 'i1',
        coverUrl: '/image/cover?id=i1',
        usageCount: 2,
        localization: 'Kraków',
      });
      expect(res.images[0].exif.cameraModel).toBe('X-T5');
    });

    it('filters to unassigned images when requested', async () => {
      const { service, prisma } = makeService();
      prisma.image.findMany.mockResolvedValue([]);
      prisma.image.count.mockResolvedValue(0);

      await service.library(40, 0, true);

      const where = prisma.image.findMany.mock.calls[0][0].where;
      expect(where.galleryItems).toEqual({ none: {} });
    });

    it('clamps take to the max', async () => {
      const { service, prisma } = makeService();
      prisma.image.findMany.mockResolvedValue([]);
      prisma.image.count.mockResolvedValue(0);

      const res = await service.library(9999, -3, false);

      expect(res.take).toBe(100); // LIBRARY_MAX_TAKE
      expect(res.skip).toBe(0);
    });
  });

  describe('setHero', () => {
    it('validates scope, dedupes preserving order, replaces in a transaction', async () => {
      const { service, prisma } = makeService();
      prisma.image.count.mockResolvedValue(2); // 2 unique valid gallery images
      prisma.heroImage.findMany.mockResolvedValue([
        {
          order: 0,
          image: {
            id: 'a',
            width: 100,
            height: 100,
            orientation: 'SQUARE',
            data: { localization: 'Kraków' },
          },
        },
      ]);

      const res = await service.setHero({ imageIds: ['a', 'b', 'a'] });

      expect(prisma.heroImage.deleteMany).toHaveBeenCalledWith({});
      const created = prisma.heroImage.createMany.mock.calls[0][0].data;
      expect(created).toEqual([
        { imageId: 'a', order: 0 },
        { imageId: 'b', order: 1 },
      ]);
      expect(res.images[0]).toMatchObject({
        imageId: 'a',
        role: GalleryImageRole.HERO,
        coverUrl: '/image/cover?id=a',
        localization: 'Kraków',
      });
    });

    it('rejects when an image is not a gallery image', async () => {
      const { service, prisma } = makeService();
      prisma.image.count.mockResolvedValue(0);

      await expect(service.setHero({ imageIds: ['x'] })).rejects.toThrow(
        /gallery images/,
      );
    });
  });

  describe('listHero', () => {
    it('reads the HeroImage list in curated order (public)', async () => {
      const { service, prisma } = makeService();
      prisma.heroImage.findMany.mockResolvedValue([
        {
          order: 0,
          image: {
            id: 'h1',
            width: 1600,
            height: 900,
            orientation: 'LANDSCAPE',
          },
        },
      ]);

      const res = await service.listHero(5);

      const args = prisma.heroImage.findMany.mock.calls[0][0];
      expect(args.orderBy).toEqual({ order: 'asc' });
      expect(args.take).toBe(5);
      expect(res.images[0]).toMatchObject({
        imageId: 'h1',
        role: GalleryImageRole.HERO,
        lowResUrl: '/image/low-res?id=h1',
      });
    });
  });

  describe('reorder', () => {
    it('writes sortOrder by index', async () => {
      const { service, prisma } = makeService();
      prisma.gallery.update.mockResolvedValue({});
      prisma.gallery.findMany.mockResolvedValue([]);

      await service.reorder(['a', 'b', 'c']);

      expect(prisma.gallery.update).toHaveBeenNthCalledWith(1, {
        where: { id: 'a' },
        data: { sortOrder: 0 },
      });
      expect(prisma.gallery.update).toHaveBeenNthCalledWith(3, {
        where: { id: 'c' },
        data: { sortOrder: 2 },
      });
    });
  });
});
