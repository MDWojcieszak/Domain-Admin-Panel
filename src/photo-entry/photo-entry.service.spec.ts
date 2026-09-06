import { PhotoEntryStatus, PhotoEntryType } from '@prisma/client';

import { PhotoEntryService } from './photo-entry.service';
import { PhotoStorageService } from '../photo-storage-service/photo-storage.service';
import { PhotoEntryFolderRole } from '../photo-storage-service/entry-structure';

/* eslint-disable @typescript-eslint/no-explicit-any */

function makeService() {
  const prisma = {
    photoEntry: { findFirst: jest.fn() },
  };
  // The real storage service — `getEntryStructure` is a pure lookup, and using
  // it for real is what makes the drift test below meaningful.
  const storage = new PhotoStorageService({ get: () => undefined } as any);
  const service = new PhotoEntryService(prisma as any, storage);
  return { service, prisma, storage };
}

const entry = {
  id: 'pe1',
  name: 'Ślub Ani i Piotra',
  type: PhotoEntryType.WORK,
  status: PhotoEntryStatus.PLANNED,
  // Local-time constructors: the folder name is formatted with getFullYear /
  // getMonth / getDate, so UTC literals would shift it in some time zones.
  startDate: new Date(2026, 4, 1),
  endDate: new Date(2026, 4, 2),
  rootPath: null,
  foldersCreated: false,
  foldersCreatedAt: null,
  createdAt: new Date(2026, 3, 1),
  updatedAt: new Date(2026, 3, 1),
  userId: 'u1',
  astroObjects: [],
};

describe('PhotoEntryService.getFolderStructure', () => {
  it('predicts the WORK root path before the folders exist', async () => {
    const { service, prisma } = makeService();
    prisma.photoEntry.findFirst.mockResolvedValueOnce(entry);

    const result = await service.getFolderStructure('u1', 'pe1');

    expect(result.folderName).toBe('2026_05_01__02D____SLUB_ANI_I_PIOTRA');
    expect(result.rootPath).toBe(
      'WORK/2026/2026_05_01__02D____SLUB_ANI_I_PIOTRA',
    );
    expect(result.foldersCreated).toBe(false);
  });

  it('files GENERAL entries under the bare year, without WORK/', async () => {
    const { service, prisma } = makeService();
    prisma.photoEntry.findFirst.mockResolvedValueOnce({
      ...entry,
      type: PhotoEntryType.GENERAL,
      name: 'Jesień w Tatrach',
    });

    const result = await service.getFolderStructure('u1', 'pe1');

    expect(result.rootPath).toBe('2026/2026_05_01__02D____JESIEN_W_TATRACH');
  });

  it('gives WORK a delivery folder and GENERAL none', async () => {
    const { service, prisma } = makeService();

    prisma.photoEntry.findFirst.mockResolvedValueOnce(entry);
    const work = await service.getFolderStructure('u1', 'pe1');

    prisma.photoEntry.findFirst.mockResolvedValueOnce({
      ...entry,
      type: PhotoEntryType.GENERAL,
    });
    const general = await service.getFolderStructure('u1', 'pe1');

    const roles = (r: { folders: { role: string }[] }) =>
      r.folders.map((f) => f.role);

    expect(roles(work)).toContain(PhotoEntryFolderRole.DELIVERY);
    expect(roles(general)).not.toContain(PhotoEntryFolderRole.DELIVERY);
    expect(general.folders).toEqual([
      { path: '01_SOURCE', role: PhotoEntryFolderRole.SOURCE },
      { path: '01_SOURCE/RAW', role: PhotoEntryFolderRole.SOURCE_RAW },
      { path: '01_SOURCE/JPEG', role: PhotoEntryFolderRole.SOURCE_JPEG },
      { path: '01_SOURCE/VIDEO', role: PhotoEntryFolderRole.SOURCE_VIDEO },
      {
        path: '01_SOURCE/SEQUENCES',
        role: PhotoEntryFolderRole.SOURCE_SEQUENCES,
      },
      { path: '02_SELECTS', role: PhotoEntryFolderRole.SELECTS },
      { path: '03_EDIT', role: PhotoEntryFolderRole.EDIT },
      { path: '04_EXPORT', role: PhotoEntryFolderRole.EXPORT },
    ]);
  });

  it('lists parents before their children, so mkdir order is safe', async () => {
    const { service, prisma } = makeService();
    prisma.photoEntry.findFirst.mockResolvedValueOnce(entry);

    const { folders } = await service.getFolderStructure('u1', 'pe1');

    folders.forEach((folder, index) => {
      const parent = folder.path.split('/').slice(0, -1).join('/');
      if (!parent) return;
      const parentIndex = folders.findIndex((f) => f.path === parent);
      expect(parentIndex).toBeGreaterThanOrEqual(0);
      expect(parentIndex).toBeLessThan(index);
    });
  });

  it('serves the stored path verbatim once folders exist', async () => {
    const { service, prisma } = makeService();
    prisma.photoEntry.findFirst.mockResolvedValueOnce({
      ...entry,
      rootPath: 'WORK/2025/LEGACY_NAME_FROM_OLD_RULES',
      foldersCreated: true,
    });

    const result = await service.getFolderStructure('u1', 'pe1');

    expect(result.rootPath).toBe('WORK/2025/LEGACY_NAME_FROM_OLD_RULES');
    expect(result.folderName).toBe('LEGACY_NAME_FROM_OLD_RULES');
    expect(result.foldersCreated).toBe(true);
  });

  it('falls back to the year alone when the entry has no dates', async () => {
    const { service, prisma } = makeService();
    prisma.photoEntry.findFirst.mockResolvedValueOnce({
      ...entry,
      startDate: null,
      endDate: null,
    });

    const result = await service.getFolderStructure('u1', 'pe1');

    expect(result.folderName).toBe('2026____SLUB_ANI_I_PIOTRA');
  });

  it('rejects ASTRO entries, which have no single root', async () => {
    const { service, prisma } = makeService();
    prisma.photoEntry.findFirst.mockResolvedValueOnce({
      ...entry,
      type: PhotoEntryType.ASTRO,
    });

    await expect(service.getFolderStructure('u1', 'pe1')).rejects.toMatchObject(
      { status: 400 },
    );
  });

  it('404s on an entry belonging to someone else', async () => {
    const { service, prisma } = makeService();
    prisma.photoEntry.findFirst.mockResolvedValueOnce(null);

    await expect(service.getFolderStructure('u2', 'pe1')).rejects.toMatchObject(
      { status: 404 },
    );
  });

  it('advertises exactly the folders create-folders would mkdir', async () => {
    const { service, prisma, storage } = makeService();
    const ensureDirectories = jest
      .spyOn(storage, 'ensureDirectories')
      .mockResolvedValue(undefined);

    prisma.photoEntry.findFirst.mockResolvedValueOnce(entry);
    const advertised = await service.getFolderStructure('u1', 'pe1');

    await storage.ensureWorkEntryStructure(advertised.rootPath);

    expect(ensureDirectories).toHaveBeenCalledWith(
      advertised.rootPath,
      advertised.folders.map((f) => f.path),
    );
  });
});
