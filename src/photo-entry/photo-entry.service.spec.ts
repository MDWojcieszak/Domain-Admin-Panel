import {
  MediaStatus,
  PhotoEntryPostStage,
  PhotoEntryStatus,
  PhotoEntryType,
} from '@prisma/client';

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

// ---------------------------------------------------------------------------
// Two axes: status (the shoot) and postStage (what was done with the material)
// ---------------------------------------------------------------------------

function makeAxisService() {
  const prisma = {
    photoEntry: { findFirst: jest.fn(), update: jest.fn() },
    photoEntryGear: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const storage = new PhotoStorageService({ get: () => undefined } as any);
  const service = new PhotoEntryService(prisma as any, storage);
  return { service, prisma };
}

const axisEntry = (overrides: Record<string, any> = {}) => ({
  ...entry,
  status: PhotoEntryStatus.SHOT,
  postStage: PhotoEntryPostStage.NONE,
  firstEditedAt: null,
  gearConfirmedAt: null,
  photoCount: null,
  selectedCount: null,
  editedCount: null,
  uploadStatus: MediaStatus.NOT_UPLOADED,
  ...overrides,
});

describe('PhotoEntryService.patchStatus', () => {
  // P1 — claiming the shoot has not happened while its material is being
  // processed. Refused rather than silently resetting the other axis.
  it('refuses a move back to PLANNED while post-processing is under way', async () => {
    const { service, prisma } = makeAxisService();
    prisma.photoEntry.findFirst.mockResolvedValue(
      axisEntry({ postStage: PhotoEntryPostStage.EDITING }),
    );

    await expect(
      service.patchStatus('u1', 'pe1', { status: PhotoEntryStatus.PLANNED }),
    ).rejects.toThrow(/has not happened/);

    expect(prisma.photoEntry.update).not.toHaveBeenCalled();
  });

  it('allows PLANNED when nothing has been processed', async () => {
    const { service, prisma } = makeAxisService();
    prisma.photoEntry.findFirst.mockResolvedValue(axisEntry());
    prisma.photoEntry.update.mockResolvedValue(
      axisEntry({ status: PhotoEntryStatus.PLANNED }),
    );

    const result = await service.patchStatus('u1', 'pe1', {
      status: PhotoEntryStatus.PLANNED,
    });

    expect(result.status).toBe(PhotoEntryStatus.PLANNED);
  });
});

describe('PhotoEntryService.patchStatus — gear (P13)', () => {
  it('refuses leaving SHOT while gear is recorded as used', async () => {
    const { service, prisma } = makeAxisService();
    prisma.photoEntry.findFirst.mockResolvedValue(axisEntry());
    prisma.photoEntryGear.findMany.mockResolvedValue([
      { used: true, secured: false },
    ]);

    await expect(
      service.patchStatus('u1', 'pe1', { status: PhotoEntryStatus.CANCELLED }),
    ).rejects.toThrow(/recorded as used/);

    expect(prisma.photoEntry.update).not.toHaveBeenCalled();
  });
});

describe('PhotoEntryService.patchPostStage', () => {
  it('refuses post-processing on an entry that has not happened', async () => {
    const { service, prisma } = makeAxisService();
    prisma.photoEntry.findFirst.mockResolvedValue(
      axisEntry({ status: PhotoEntryStatus.PLANNED }),
    );

    await expect(
      service.patchPostStage('u1', 'pe1', {
        postStage: PhotoEntryPostStage.EDITING,
      }),
    ).rejects.toThrow(/has not happened/);
  });

  // P2 — the "was edited" fact has to survive a later move back to NONE.
  it('stamps firstEditedAt on the first move away from NONE', async () => {
    const { service, prisma } = makeAxisService();
    prisma.photoEntry.findFirst.mockResolvedValue(axisEntry());
    prisma.photoEntry.update.mockResolvedValue(
      axisEntry({ postStage: PhotoEntryPostStage.SELECTING }),
    );

    await service.patchPostStage('u1', 'pe1', {
      postStage: PhotoEntryPostStage.SELECTING,
    });

    expect(prisma.photoEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ firstEditedAt: expect.any(Date) }),
      }),
    );
  });

  it('never re-stamps an entry that was already edited', async () => {
    const { service, prisma } = makeAxisService();
    const stamped = new Date(2026, 1, 1);
    prisma.photoEntry.findFirst.mockResolvedValue(
      axisEntry({
        postStage: PhotoEntryPostStage.SELECTING,
        firstEditedAt: stamped,
      }),
    );
    prisma.photoEntry.update.mockResolvedValue(
      axisEntry({
        postStage: PhotoEntryPostStage.EDITING,
        firstEditedAt: stamped,
      }),
    );

    await service.patchPostStage('u1', 'pe1', {
      postStage: PhotoEntryPostStage.EDITING,
    });

    expect(prisma.photoEntry.update.mock.calls[0][0].data).not.toHaveProperty(
      'firstEditedAt',
    );
  });

  it('does not stamp a move back to NONE', async () => {
    const { service, prisma } = makeAxisService();
    prisma.photoEntry.findFirst.mockResolvedValue(axisEntry());
    prisma.photoEntry.update.mockResolvedValue(axisEntry());

    await service.patchPostStage('u1', 'pe1', {
      postStage: PhotoEntryPostStage.NONE,
    });

    expect(prisma.photoEntry.update.mock.calls[0][0].data).not.toHaveProperty(
      'firstEditedAt',
    );
  });
});

describe('PhotoEntryService.patchProgress', () => {
  // P7 — "10 of 200 left" becomes nonsense if the counts can outrun each other.
  it('refuses more edited than selected', async () => {
    const { service, prisma } = makeAxisService();
    prisma.photoEntry.findFirst.mockResolvedValue(
      axisEntry({ photoCount: 200, selectedCount: 40 }),
    );

    await expect(
      service.patchProgress('u1', 'pe1', { editedCount: 50 }),
    ).rejects.toThrow(/cannot exceed selectedCount/);
  });

  it('accepts a consistent set', async () => {
    const { service, prisma } = makeAxisService();
    prisma.photoEntry.findFirst.mockResolvedValue(axisEntry());
    prisma.photoEntry.update.mockResolvedValue(
      axisEntry({ photoCount: 200, selectedCount: 42, editedCount: 32 }),
    );

    const result = await service.patchProgress('u1', 'pe1', {
      photoCount: 200,
      selectedCount: 42,
      editedCount: 32,
    });

    expect(result.remainingToEdit).toBe(10);
  });

  // Omitted means "leave alone"; explicit null means "back to unknown".
  it('leaves omitted counts untouched', async () => {
    const { service, prisma } = makeAxisService();
    prisma.photoEntry.findFirst.mockResolvedValue(
      axisEntry({ photoCount: 200, selectedCount: 42, editedCount: 10 }),
    );
    prisma.photoEntry.update.mockResolvedValue(
      axisEntry({ photoCount: 200, selectedCount: 42, editedCount: 20 }),
    );

    await service.patchProgress('u1', 'pe1', { editedCount: 20 });

    expect(prisma.photoEntry.update.mock.calls[0][0].data).toEqual({
      photoCount: 200,
      selectedCount: 42,
      editedCount: 20,
      // Marks the write so the nightly folder scan does not overwrite it.
      countsSource: 'REPORTED',
      countsUpdatedAt: expect.any(Date),
    });
  });

  it('clears a count back to unknown when sent null', async () => {
    const { service, prisma } = makeAxisService();
    prisma.photoEntry.findFirst.mockResolvedValue(
      axisEntry({ photoCount: 200, selectedCount: 42, editedCount: 10 }),
    );
    prisma.photoEntry.update.mockResolvedValue(axisEntry({ photoCount: 200 }));

    const result = await service.patchProgress('u1', 'pe1', {
      selectedCount: null,
      editedCount: null,
    });

    expect(result.remainingToEdit).toBeNull();
  });
});
