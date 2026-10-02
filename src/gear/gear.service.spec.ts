import { GearOwnership, PhotoEntryStatus } from '@prisma/client';

import { GearItemsSort } from './dto';
import { GearService, ownershipDates } from './gear.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

function makeService() {
  const prisma = {
    gearItem: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    gearSystem: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    image: { count: jest.fn() },
    photoEntryGear: { findMany: jest.fn(), deleteMany: jest.fn() },
    $transaction: jest.fn((arg: any) =>
      typeof arg === 'function' ? arg(prisma) : Promise.all(arg),
    ),
  };
  const service = new GearService(prisma as any);
  return { service, prisma };
}

const item = (over: any) => ({
  id: 'i',
  category: 'CAMERA',
  brand: 'Fuji',
  model: 'X-T5',
  systemId: null,
  description: null,
  imageId: null,
  order: 0,
  visible: true,
  ownership: 'OWNED',
  acquiredAt: null,
  retiredAt: null,
  priority: null,
  estimatedPrice: null,
  purchaseUrl: null,
  entries: [],
  ...over,
});

const planned = (id: string, startDate: Date | null) => ({
  photoEntry: { id, name: id, status: PhotoEntryStatus.PLANNED, startDate },
});

const inDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

describe('GearService', () => {
  describe('overview', () => {
    it('groups visible items under their system and collects the rest as ungrouped', async () => {
      const { service, prisma } = makeService();
      prisma.gearSystem.findMany.mockResolvedValue([
        {
          id: 's1',
          name: 'Fujifilm X',
          label: 'APS-C',
          description: 'lekki system',
          imageId: null,
          order: 0,
          visible: true,
        },
      ]);
      prisma.gearItem.findMany.mockResolvedValue([
        item({ id: 'i1', systemId: 's1' }),
        item({ id: 'i2', category: 'TRIPOD', systemId: null }),
        item({ id: 'i3', category: 'LENS', systemId: 'ghost' }), // system not in list → dropped
      ]);

      const res = await service.listPublic();

      expect(prisma.gearSystem.findMany.mock.calls[0][0].where).toEqual({
        visible: true,
      });
      expect(res.systems).toHaveLength(1);
      expect(res.systems[0].items.map((i) => i.id)).toEqual(['i1']);
      expect(res.systems[0]).toMatchObject({
        name: 'Fujifilm X',
        label: 'APS-C',
      });
      expect(res.ungrouped.map((i) => i.id)).toEqual(['i2']);
    });

    // P10 — the public portfolio must never carry the shopping list.
    it('public listing serves only owned gear', async () => {
      const { service, prisma } = makeService();
      prisma.gearSystem.findMany.mockResolvedValue([]);
      prisma.gearItem.findMany.mockResolvedValue([]);

      await service.listPublic();

      expect(prisma.gearItem.findMany.mock.calls[0][0].where).toEqual({
        visible: true,
        ownership: GearOwnership.OWNED,
      });
    });

    it('admin listAll does not filter by visible', async () => {
      const { service, prisma } = makeService();
      prisma.gearSystem.findMany.mockResolvedValue([]);
      prisma.gearItem.findMany.mockResolvedValue([]);

      await service.listAll();

      expect(prisma.gearSystem.findMany.mock.calls[0][0].where).toEqual({});
    });
  });

  describe('create', () => {
    it('creates an item at the next order and validates system + image', async () => {
      const { service, prisma } = makeService();
      prisma.image.count.mockResolvedValue(1);
      prisma.gearSystem.count.mockResolvedValue(1);
      prisma.gearItem.findFirst.mockResolvedValue({ order: 4 });
      const created = item({
        id: 'n',
        category: 'LENS',
        model: '23',
        systemId: 's1',
        order: 5,
      });
      prisma.gearItem.create.mockResolvedValue(created);
      prisma.gearItem.findUnique.mockResolvedValue(created);

      const res = await service.create({
        category: 'LENS',
        brand: 'Fuji',
        model: '23',
        systemId: 's1',
        imageId: 'img',
      } as any);

      expect(prisma.image.count).toHaveBeenCalled();
      expect(prisma.gearSystem.count).toHaveBeenCalled();
      expect(prisma.gearItem.create.mock.calls[0][0].data.order).toBe(5);
      expect(res).toMatchObject({ id: 'n', systemId: 's1' });
    });

    it('rejects when the referenced system does not exist', async () => {
      const { service, prisma } = makeService();
      prisma.gearSystem.count.mockResolvedValue(0);

      await expect(
        service.create({
          category: 'LENS',
          brand: 'Fuji',
          model: '23',
          systemId: 'bad',
        } as any),
      ).rejects.toThrow(/system/i);
    });
  });

  describe('listItems (neededBy, §4)', () => {
    it('sorts the wishlist by deadline and sums its prices', async () => {
      const { service, prisma } = makeService();
      prisma.gearItem.findMany.mockResolvedValue([
        item({ id: 'undated', ownership: 'WISHLIST', estimatedPrice: 100 }),
        item({
          id: 'iceland',
          ownership: 'WISHLIST',
          estimatedPrice: 9000,
          entries: [planned('iceland', inDays(160))],
        }),
        item({
          id: 'eclipse',
          ownership: 'WISHLIST',
          estimatedPrice: 500,
          entries: [planned('eclipse', inDays(10))],
        }),
      ]);

      const res = await service.listItems({
        ownership: GearOwnership.WISHLIST,
        sort: GearItemsSort.NEEDED_BY,
      });

      expect(res.items.map((i) => i.id)).toEqual([
        'eclipse',
        'iceland',
        'undated',
      ]);
      expect(res.items[0].neededFor?.id).toBe('eclipse');
      expect(res.wishlistTotal).toBe(9600);
    });

    it('narrows to a horizon, and the total follows it', async () => {
      const { service, prisma } = makeService();
      prisma.gearItem.findMany.mockResolvedValue([
        item({
          id: 'soon',
          ownership: 'WISHLIST',
          estimatedPrice: 500,
          entries: [planned('eclipse', inDays(10))],
        }),
        item({
          id: 'later',
          ownership: 'WISHLIST',
          estimatedPrice: 9000,
          entries: [planned('iceland', inDays(160))],
        }),
        item({
          id: 'owned',
          estimatedPrice: 7000,
          entries: [planned('x', inDays(5))],
        }),
      ]);

      const res = await service.listItems({ neededWithinDays: 90 });

      expect(res.items.map((i) => i.id)).toEqual(['soon', 'owned']);
      // Owned gear is not something to buy, whatever its price field says.
      expect(res.wishlistTotal).toBe(500);
    });
  });

  describe('remove (P12)', () => {
    it('deletes gear carrying only plans, together with those plans', async () => {
      const { service, prisma } = makeService();
      prisma.gearItem.findUnique.mockResolvedValue(
        item({ ownership: 'WISHLIST' }),
      );
      prisma.photoEntryGear.findMany.mockResolvedValue([
        { used: false, secured: false },
      ]);

      await service.remove('i');

      expect(prisma.photoEntryGear.deleteMany).toHaveBeenCalledWith({
        where: { gearItemId: 'i' },
      });
      expect(prisma.gearItem.delete).toHaveBeenCalledWith({
        where: { id: 'i' },
      });
    });

    it('refuses gear with recorded use', async () => {
      const { service, prisma } = makeService();
      prisma.gearItem.findUnique.mockResolvedValue(item({}));
      prisma.photoEntryGear.findMany.mockResolvedValue([
        { used: true, secured: true },
      ]);

      await expect(service.remove('i')).rejects.toThrow(/retire/);
      expect(prisma.gearItem.delete).not.toHaveBeenCalled();
    });
  });

  describe('ownershipDates', () => {
    const now = new Date('2026-10-02T12:00:00Z');
    const base = { acquiredAt: null, retiredAt: null };

    it('stamps acquiredAt when a wishlist item is bought', () => {
      expect(
        ownershipDates(
          { ...base, ownership: GearOwnership.WISHLIST },
          { ownership: GearOwnership.OWNED },
          now,
        ),
      ).toEqual({ acquiredAt: now, retiredAt: undefined });
    });

    it('stamps retiredAt when gear is retired', () => {
      expect(
        ownershipDates(
          { ...base, ownership: GearOwnership.OWNED },
          { ownership: GearOwnership.RETIRED },
          now,
        ).retiredAt,
      ).toEqual(now);
    });

    it('never overwrites a known date or an explicit one', () => {
      const known = new Date('2020-01-01');
      expect(
        ownershipDates(
          { ...base, ownership: GearOwnership.WISHLIST, acquiredAt: known },
          { ownership: GearOwnership.OWNED },
          now,
        ).acquiredAt,
      ).toBeUndefined();
      expect(
        ownershipDates(
          { ...base, ownership: GearOwnership.WISHLIST },
          {
            ownership: GearOwnership.OWNED,
            acquiredAt: '2026-09-01T00:00:00Z',
          },
          now,
        ).acquiredAt,
      ).toEqual(new Date('2026-09-01T00:00:00Z'));
    });
  });

  describe('createSystem', () => {
    it('creates a system at the next order', async () => {
      const { service, prisma } = makeService();
      prisma.gearSystem.findFirst.mockResolvedValue({ order: 2 });
      prisma.gearSystem.create.mockResolvedValue({
        id: 's',
        name: 'Fujifilm GFX',
        label: 'Medium Format',
        description: 'do krajobrazu',
        imageId: null,
        order: 3,
        visible: true,
      });

      const res = await service.createSystem({
        name: 'Fujifilm GFX',
        label: 'Medium Format',
        description: 'do krajobrazu',
      } as any);

      expect(prisma.gearSystem.create.mock.calls[0][0].data.order).toBe(3);
      expect(res).toMatchObject({
        id: 's',
        name: 'Fujifilm GFX',
        label: 'Medium Format',
        items: [],
      });
    });
  });

  describe('reorder', () => {
    it('reorderItems writes order by index', async () => {
      const { service, prisma } = makeService();
      prisma.gearItem.update.mockResolvedValue({});
      prisma.gearSystem.findMany.mockResolvedValue([]);
      prisma.gearItem.findMany.mockResolvedValue([]);

      await service.reorderItems(['a', 'b']);

      expect(prisma.gearItem.update).toHaveBeenNthCalledWith(1, {
        where: { id: 'a' },
        data: { order: 0 },
      });
      expect(prisma.gearItem.update).toHaveBeenNthCalledWith(2, {
        where: { id: 'b' },
        data: { order: 1 },
      });
    });

    it('reorderSystems writes order by index', async () => {
      const { service, prisma } = makeService();
      prisma.gearSystem.update.mockResolvedValue({});
      prisma.gearSystem.findMany.mockResolvedValue([]);
      prisma.gearItem.findMany.mockResolvedValue([]);

      await service.reorderSystems(['s1', 's2']);

      expect(prisma.gearSystem.update).toHaveBeenNthCalledWith(2, {
        where: { id: 's2' },
        data: { order: 1 },
      });
    });
  });
});
