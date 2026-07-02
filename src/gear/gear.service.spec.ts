import { GearService } from './gear.service';

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
    $transaction: jest.fn((arg: any) =>
      typeof arg === 'function' ? arg({}) : Promise.all(arg),
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
  ...over,
});

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
      prisma.gearItem.create.mockResolvedValue(
        item({
          id: 'n',
          category: 'LENS',
          model: '23',
          systemId: 's1',
          order: 5,
        }),
      );

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
