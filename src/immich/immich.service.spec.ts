import { ImmichAlbumSource } from '@prisma/client';

// @immich/sdk ships as ESM; jest doesn't transform node_modules. The real SDK
// is never exercised here (ImmichApiService is injected as a mock), so a stub
// module is enough to satisfy the static imports.
jest.mock('@immich/sdk', () => ({
  AssetMediaSize: {
    Original: 'original',
    Fullsize: 'fullsize',
    Preview: 'preview',
    Thumbnail: 'thumbnail',
  },
  getServerVersion: jest.fn(),
  createAlbum: jest.fn(),
  getAlbumInfo: jest.fn(),
  getAllAlbums: jest.fn(),
  deleteAlbum: jest.fn(),
  addAssetsToAlbum: jest.fn(),
  removeAssetFromAlbum: jest.fn(),
  getAssetsByOriginalPath: jest.fn(),
  getUniqueOriginalPaths: jest.fn(),
  getAllLibraries: jest.fn(),
  getLibraryStatistics: jest.fn(),
  scanLibrary: jest.fn(),
  viewAsset: jest.fn(),
}));

import { ImmichService } from './immich.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

const date = new Date('2026-06-28T10:00:00.000Z');

function makeService() {
  const immichApi = {
    getConnectionInfo: jest.fn(),
    getAllAlbums: jest.fn(),
    getAlbum: jest.fn(),
    createAlbum: jest.fn(),
    deleteAlbum: jest.fn().mockResolvedValue(undefined),
    addAssetsToAlbum: jest.fn(),
    removeAssetsFromAlbum: jest.fn().mockResolvedValue(0),
    getAssetsByFolders: jest.fn(),
    listUniqueFolderPaths: jest.fn().mockResolvedValue([]),
  };

  const prisma = {
    apiKey: { deleteMany: jest.fn() },
    photoEntry: { findFirst: jest.fn() },
    photoEntryImmichAlbum: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
      deleteMany: jest.fn(),
    },
  };

  const tokenService = { saveServiceToken: jest.fn() };

  const service = new ImmichService(
    tokenService as any,
    prisma as any,
    immichApi as any,
  );

  return { service, immichApi, prisma };
}

const CONNECTED = {
  configured: true,
  baseUrl: 'https://photo.whcp.pl/api',
  libraryPath: '/media/vault',
};

describe('ImmichService', () => {
  describe('browseAlbums', () => {
    it('groups tracked links under their Immich album and builds urls', async () => {
      const { service, immichApi, prisma } = makeService();

      immichApi.getAllAlbums.mockResolvedValue([
        {
          id: 'A',
          albumName: 'Album A',
          assetCount: 5,
          thumbnailAssetId: 't1',
        },
        {
          id: 'B',
          albumName: 'Album B',
          assetCount: 0,
          thumbnailAssetId: null,
        },
      ]);
      prisma.photoEntryImmichAlbum.findMany.mockResolvedValue([
        {
          id: 'l1',
          albumId: 'A',
          photoEntryId: 'e1',
          source: ImmichAlbumSource.EXPORT,
          astroObjectId: null,
          lastAssetCount: 5,
          lastSyncedAt: date,
          createdAt: date,
        },
      ]);
      immichApi.getConnectionInfo.mockResolvedValue(CONNECTED);

      const result = await service.browseAlbums('u1');

      expect(result.total).toBe(2);
      const albumA = result.albums.find((a) => a.albumId === 'A')!;
      expect(albumA.albumUrl).toBe('https://photo.whcp.pl/albums/A');
      expect(albumA.thumbnailUrl).toBe('/immich/asset/t1/thumbnail');
      expect(albumA.entries).toHaveLength(1);
      expect(albumA.entries[0].id).toBe('l1');

      const albumB = result.albums.find((a) => a.albumId === 'B')!;
      expect(albumB.entries).toHaveLength(0);
      expect(albumB.thumbnailUrl).toBeNull();
    });
  });

  describe('createAlbum', () => {
    it('deletes the Immich album if persisting the link fails (no orphan)', async () => {
      const { service, immichApi, prisma } = makeService();

      immichApi.getConnectionInfo.mockResolvedValue(CONNECTED);
      prisma.photoEntry.findFirst.mockResolvedValue({
        id: 'e1',
        name: 'Entry',
        rootPath: '2026/x',
        astroObjects: [],
      });
      immichApi.getAssetsByFolders.mockResolvedValue([
        { id: 'a1' },
        { id: 'a2' },
      ]);
      immichApi.createAlbum.mockResolvedValue({
        id: 'AL',
        albumName: 'Entry',
        assetCount: 2,
      });
      prisma.photoEntryImmichAlbum.create.mockRejectedValue(new Error('db'));

      await expect(
        service.createAlbum('u1', { photoEntryId: 'e1' } as any),
      ).rejects.toThrow('db');

      expect(immichApi.deleteAlbum).toHaveBeenCalledWith('u1', 'AL');
    });
  });

  describe('attachEntry', () => {
    it('reports the real added count and existing+added total', async () => {
      const { service, immichApi, prisma } = makeService();

      immichApi.getConnectionInfo.mockResolvedValue(CONNECTED);
      immichApi.getAlbum.mockResolvedValue({
        id: 'AL',
        albumName: 'AL',
        assetCount: 1,
        assets: [{ id: 'x1' }],
      });
      prisma.photoEntry.findFirst.mockResolvedValue({
        id: 'e1',
        name: 'Entry',
        rootPath: '2026/x',
        astroObjects: [],
      });
      immichApi.getAssetsByFolders.mockResolvedValue([
        { id: 'x1' },
        { id: 'x2' },
        { id: 'x3' },
      ]);
      immichApi.addAssetsToAlbum.mockResolvedValue(2);
      prisma.photoEntryImmichAlbum.findFirst.mockResolvedValue(null);
      prisma.photoEntryImmichAlbum.create.mockResolvedValue({ id: 'newlink' });

      const res = await service.attachEntry('u1', 'AL', {
        photoEntryId: 'e1',
      } as any);

      // x1 already in album → only x2,x3 offered to Immich
      expect(immichApi.addAssetsToAlbum).toHaveBeenCalledWith('u1', 'AL', [
        'x2',
        'x3',
      ]);
      expect(res.assetsFound).toBe(3);
      expect(res.assetsAdded).toBe(2);
      expect(res.totalAlbumAssets).toBe(3); // existing 1 + added 2
      expect(res.assets).toHaveLength(2);
    });
  });

  describe('detachEntry', () => {
    it('keeps assets still contributed by other links of the same album', async () => {
      const { service, immichApi, prisma } = makeService();

      prisma.photoEntryImmichAlbum.findFirst.mockResolvedValue({
        id: 'l1',
        albumId: 'AL',
        photoEntryId: 'e1',
        source: ImmichAlbumSource.EXPORT,
        astroObjectId: null,
      });
      immichApi.getConnectionInfo.mockResolvedValue(CONNECTED);

      // entry lookups: first the detached link's entry, then the other link's
      prisma.photoEntry.findFirst
        .mockResolvedValueOnce({
          id: 'e1',
          name: 'E1',
          rootPath: '2026/e1',
          astroObjects: [],
        })
        .mockResolvedValueOnce({
          id: 'e2',
          name: 'E2',
          rootPath: '2026/e2',
          astroObjects: [],
        });

      immichApi.getAssetsByFolders
        .mockResolvedValueOnce([{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }]) // my link
        .mockResolvedValueOnce([{ id: 'a2' }]); // other link (shared a2)

      prisma.photoEntryImmichAlbum.findMany.mockResolvedValue([
        {
          id: 'l2',
          albumId: 'AL',
          photoEntryId: 'e2',
          source: ImmichAlbumSource.EXPORT,
          astroObjectId: null,
        },
      ]);
      immichApi.removeAssetsFromAlbum.mockResolvedValue(2);

      const res = await service.detachEntry('u1', 'l1', true);

      expect(immichApi.removeAssetsFromAlbum).toHaveBeenCalledWith('u1', 'AL', [
        'a1',
        'a3',
      ]);
      expect(res).toEqual({ id: 'l1', removedAssets: 2 });
      expect(prisma.photoEntryImmichAlbum.delete).toHaveBeenCalledWith({
        where: { id: 'l1' },
      });
    });

    it('only unlinks when removeAssets=false', async () => {
      const { service, immichApi, prisma } = makeService();

      prisma.photoEntryImmichAlbum.findFirst.mockResolvedValue({
        id: 'l1',
        albumId: 'AL',
        photoEntryId: 'e1',
        source: ImmichAlbumSource.EXPORT,
        astroObjectId: null,
      });

      const res = await service.detachEntry('u1', 'l1', false);

      expect(immichApi.removeAssetsFromAlbum).not.toHaveBeenCalled();
      expect(res).toEqual({ id: 'l1', removedAssets: 0 });
      expect(prisma.photoEntryImmichAlbum.delete).toHaveBeenCalled();
    });
  });

  describe('deleteAlbum', () => {
    it('deletes in Immich and removes our links', async () => {
      const { service, immichApi, prisma } = makeService();

      prisma.photoEntryImmichAlbum.deleteMany.mockResolvedValue({ count: 3 });

      const res = await service.deleteAlbum('u1', 'AL');

      expect(immichApi.deleteAlbum).toHaveBeenCalledWith('u1', 'AL');
      expect(prisma.photoEntryImmichAlbum.deleteMany).toHaveBeenCalledWith({
        where: { albumId: 'AL', photoEntry: { userId: 'u1' } },
      });
      expect(res).toEqual({ albumId: 'AL', removedLinks: 3 });
    });
  });
});
