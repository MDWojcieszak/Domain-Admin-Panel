import { IntegrationMaintenanceService } from './integration-maintenance.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

function makeService() {
  const prisma = {
    deviceAuthorization: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const service = new IntegrationMaintenanceService(prisma as any);
  return { service, prisma };
}

describe('IntegrationMaintenanceService', () => {
  it('deletes handshakes that expired over a day ago', async () => {
    const { service, prisma } = makeService();
    prisma.deviceAuthorization.deleteMany.mockResolvedValueOnce({ count: 7 });

    const result = await service.run();

    expect(result).toEqual({ deleted: 7 });

    const cutoff = prisma.deviceAuthorization.deleteMany.mock.calls[0][0].where
      .expiresAt.lt as Date;
    const ageHours = (Date.now() - cutoff.getTime()) / 3_600_000;
    // ~24 h of grace: long enough to debug a failed connect, short enough that
    // the table does not grow without bound.
    expect(ageHours).toBeGreaterThan(23);
    expect(ageHours).toBeLessThan(25);
  });

  it('leaves recently expired handshakes alone', async () => {
    const { service, prisma } = makeService();

    await service.run();

    const cutoff = prisma.deviceAuthorization.deleteMany.mock.calls[0][0].where
      .expiresAt.lt as Date;
    // A code that expired ten minutes ago is still inspectable.
    expect(cutoff.getTime()).toBeLessThan(Date.now() - 10 * 60 * 1000);
  });

  it('prunes regardless of status, without touching issued tokens', async () => {
    const { service, prisma } = makeService();

    await service.run();

    const where = prisma.deviceAuthorization.deleteMany.mock.calls[0][0].where;
    // Filtering on status would strand APPROVED-but-abandoned rows forever.
    expect(Object.keys(where)).toEqual(['expiresAt']);
  });

  it('is a no-op when there is nothing to prune', async () => {
    const { service } = makeService();

    await expect(service.run()).resolves.toEqual({ deleted: 0 });
  });
});
