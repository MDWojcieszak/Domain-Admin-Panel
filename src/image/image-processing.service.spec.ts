import { ImageProcessingStatus } from '@prisma/client';

jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue(Buffer.from('original')),
}));

import { ImageProcessingService } from './image-processing.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

function makeService() {
  const prisma = {
    image: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      count: jest.fn(),
      findMany: jest.fn(),
    },
  };
  // The shared engine — generation + DONE stamping lives here (mocked).
  const fileService = {
    processImage: jest.fn().mockResolvedValue(undefined),
  };
  const service = new ImageProcessingService(prisma as any, fileService as any);
  return { service, prisma, fileService };
}

const image = { id: 'i1', originalUrl: '/o/i1.jpg' };

describe('ImageProcessingService', () => {
  describe('reprocess', () => {
    it('rebuilds from the original and marks PROCESSING then DONE', async () => {
      const { service, prisma, fileService } = makeService();
      prisma.image.findUnique.mockResolvedValue(image);

      const res = await service.reprocess('i1');

      expect(res).toEqual({ id: 'i1', status: ImageProcessingStatus.DONE });
      expect(fileService.processImage).toHaveBeenCalledWith(
        'i1',
        expect.any(Buffer),
      );
      expect(prisma.image.update).toHaveBeenCalledWith({
        where: { id: 'i1' },
        data: {
          processingStatus: ImageProcessingStatus.PROCESSING,
          processingError: null,
        },
      });
    });

    it('records FAILED + error when the engine throws', async () => {
      const { service, prisma, fileService } = makeService();
      prisma.image.findUnique.mockResolvedValue(image);
      fileService.processImage.mockRejectedValueOnce(new Error('sharp boom'));

      const res = await service.reprocess('i1');

      expect(res.status).toBe(ImageProcessingStatus.FAILED);
      const last = prisma.image.update.mock.calls.at(-1)![0];
      expect(last.data).toMatchObject({
        processingStatus: ImageProcessingStatus.FAILED,
        processingError: 'sharp boom',
      });
    });
  });

  describe('getSummary', () => {
    it('derives counts and pending', async () => {
      const { service, prisma } = makeService();
      // total, done, processing, failed
      prisma.image.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(6)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2);

      const summary = await service.getSummary();

      expect(summary).toEqual({
        total: 10,
        done: 6,
        processing: 1,
        failed: 2,
        pending: 1, // 10 - 6 - 1 - 2
      });
    });
  });

  describe('runBatch', () => {
    it('aggregates done/failed across ids', async () => {
      const { service, prisma, fileService } = makeService();
      prisma.image.findUnique.mockImplementation(({ where }: any) =>
        Promise.resolve({ id: where.id, originalUrl: `/o/${where.id}.jpg` }),
      );
      fileService.processImage.mockImplementation((id: string) =>
        id === 'boom'
          ? Promise.reject(new Error('x'))
          : Promise.resolve(undefined),
      );

      const res = await service.runBatch(['ok', 'boom']);

      expect(res).toEqual({ total: 2, done: 1, failed: 1 });
    });
  });
});
