import {
  GearCategory,
  GearOwnership,
  MediaStatus,
  PhotoEntryStatus,
} from '@prisma/client';

import { PhotoEntryGearService } from './photo-entry-gear.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

const entry = (over: Record<string, any> = {}) => ({
  id: 'pe1',
  userId: 'u1',
  name: 'Eclipse',
  status: PhotoEntryStatus.SHOT,
  gearConfirmedAt: null,
  uploadStatus: MediaStatus.NOT_UPLOADED,
  startDate: null,
  ...over,
});

const gear = (over: Record<string, any> = {}) => ({
  id: 'g1',
  category: GearCategory.CAMERA,
  brand: 'Fujifilm',
  model: 'GFX 100S II',
  ownership: GearOwnership.OWNED,
  systemId: null,
  description: null,
  imageId: null,
  order: 0,
  visible: true,
  priority: null,
  estimatedPrice: null,
  purchaseUrl: null,
  ...over,
});

function makeService() {
  const prisma: any = {
    photoEntry: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    photoEntryGear: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    gearItem: { findMany: jest.fn() },
    $transaction: jest.fn((fn: any) => fn(prisma)),
  };
  return { service: new PhotoEntryGearService(prisma), prisma };
}

describe('PhotoEntryGearService', () => {
  it('refuses marking wishlist gear as used (P11)', async () => {
    const { service, prisma } = makeService();
    prisma.photoEntry.findFirst.mockResolvedValue(entry());
    prisma.gearItem.findMany.mockResolvedValue([
      gear({ ownership: GearOwnership.WISHLIST }),
    ]);

    await expect(
      service.add('u1', 'pe1', 'g1', { used: true }),
    ).rejects.toThrow(/Wishlist/);
    expect(prisma.photoEntryGear.upsert).not.toHaveBeenCalled();
  });

  it('refuses confirming gear before the shoot happened', async () => {
    const { service, prisma } = makeService();
    prisma.photoEntry.findFirst.mockResolvedValue(
      entry({ status: PhotoEntryStatus.PLANNED }),
    );

    await expect(service.confirm('u1', 'pe1')).rejects.toThrow(/SHOT/);
  });

  // §6 — the desktop uploader's shortcut secures media sources only and
  // declares the gear, so uploadStatus is derived, not just written.
  it('mark-media-uploaded secures used media rows and derives UPLOADED', async () => {
    const { service, prisma } = makeService();
    const confirmedAt = new Date();
    prisma.photoEntry.findUnique.mockResolvedValue(entry());
    prisma.photoEntryGear.findMany.mockResolvedValue([
      { id: 'r-camera', gearItem: gear() },
      { id: 'r-tripod', gearItem: gear({ category: GearCategory.TRIPOD }) },
    ]);
    prisma.photoEntry.findUniqueOrThrow.mockResolvedValue({
      ...entry({ gearConfirmedAt: confirmedAt }),
      gear: [
        { used: true, secured: true, gearItem: gear() },
        {
          used: true,
          secured: false,
          gearItem: gear({ category: GearCategory.TRIPOD }),
        },
      ],
    });
    prisma.photoEntry.update.mockImplementation(({ data }: any) =>
      Promise.resolve(entry({ gearConfirmedAt: confirmedAt, ...data })),
    );

    const result = await service.markMediaUploaded('pe1');

    expect(prisma.photoEntryGear.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['r-camera'] } },
      data: { secured: true, securedAt: expect.any(Date) },
    });
    expect(prisma.photoEntry.update).toHaveBeenLastCalledWith({
      where: { id: 'pe1' },
      data: { uploadStatus: MediaStatus.UPLOADED },
    });
    expect(result.uploadStatus).toBe(MediaStatus.UPLOADED);
  });
});
