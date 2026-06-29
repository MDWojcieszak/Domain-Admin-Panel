import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ConnectedServiceType,
  ImmichAlbumSource,
  PhotoEntry,
  PhotoEntryImmichAlbum,
} from '@prisma/client';
import { AssetMediaSize } from '@immich/sdk';

import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from '../token/token.service';

import { ImmichApiService, ImmichThumbnail } from './immich-api.service';
import {
  AttachEntryDto,
  CreateEmptyAlbumDto,
  CreateImmichAlbumDto,
  PreviewImmichAlbumDto,
  SaveImmichConfigDto,
  ThumbnailSize,
} from './dto';
import { ALBUM_SOURCE_SUBFOLDER } from './immich-album-source';
import { ImmichMapper } from './mappers';
import {
  ImmichAlbumBrowseResponse,
  ImmichAlbumDeletedResponse,
  ImmichAlbumListResponse,
  ImmichAlbumPreviewResponse,
  ImmichAlbumRemovedResponse,
  ImmichAlbumSyncResponse,
  ImmichBrowseAlbumResponse,
  ImmichLibraryListResponse,
  ImmichStatusResponse,
} from './responses';

type EntrySources = {
  entry: PhotoEntry;
  sourcePaths: string[];
};

@Injectable()
export class ImmichService {
  constructor(
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
    private readonly immichApi: ImmichApiService,
  ) {}

  // ----------------------------------------------------------------
  // Connection config (URL + token)
  // ----------------------------------------------------------------

  async saveConfig(
    userId: string,
    dto: SaveImmichConfigDto,
  ): Promise<ImmichStatusResponse> {
    const baseUrl = this.normalizeBaseUrl(dto.baseUrl);
    const libraryPath = this.normalizeLibraryPath(dto.libraryPath);

    await this.tokenService.saveServiceToken(
      userId,
      {
        service: ConnectedServiceType.IMMICH,
        value: dto.apiKey,
        name: dto.name ?? 'Immich',
      },
      { baseUrl, libraryPath },
    );

    // Verify the credentials by pinging Immich right away.
    const ping = await this.immichApi.ping(userId);

    return ImmichMapper.mapStatus({
      configured: true,
      connected: ping.connected,
      serverVersion: ping.serverVersion,
      baseUrl,
      libraryPath,
    });
  }

  async getStatus(userId: string): Promise<ImmichStatusResponse> {
    const info = await this.immichApi.getConnectionInfo(userId);

    if (!info.configured) {
      return ImmichMapper.mapStatus({
        configured: false,
        connected: false,
        baseUrl: info.baseUrl,
        libraryPath: info.libraryPath,
      });
    }

    const ping = await this.immichApi.ping(userId);

    return ImmichMapper.mapStatus({
      configured: true,
      connected: ping.connected,
      serverVersion: ping.serverVersion,
      baseUrl: info.baseUrl,
      libraryPath: info.libraryPath,
    });
  }

  async removeConfig(userId: string): Promise<ImmichStatusResponse> {
    await this.prisma.apiKey.deleteMany({
      where: { userId, service: ConnectedServiceType.IMMICH },
    });

    return ImmichMapper.mapStatus({ configured: false, connected: false });
  }

  // ----------------------------------------------------------------
  // Albums
  // ----------------------------------------------------------------

  async listAlbums(
    userId: string,
    photoEntryId?: string,
  ): Promise<ImmichAlbumListResponse> {
    if (photoEntryId) {
      await this.assertEntryOwnership(userId, photoEntryId);
    }

    const albums = await this.prisma.photoEntryImmichAlbum.findMany({
      where: {
        photoEntry: { userId },
        ...(photoEntryId ? { photoEntryId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    const baseUrl = (await this.immichApi.getConnectionInfo(userId)).baseUrl;

    return {
      total: albums.length,
      albums: albums.map((album) =>
        ImmichMapper.mapAlbumItem(
          album,
          this.buildAlbumWebUrl(baseUrl, album.albumId),
        ),
      ),
    };
  }

  /**
   * Album-centric browse: every album that lives in Immich (the source of
   * truth), enriched with the photo entries we track as contributing to it.
   */
  async browseAlbums(userId: string): Promise<ImmichAlbumBrowseResponse> {
    const [immichAlbums, links, info] = await Promise.all([
      this.immichApi.getAllAlbums(userId),
      this.prisma.photoEntryImmichAlbum.findMany({
        where: { photoEntry: { userId } },
        orderBy: { createdAt: 'desc' },
      }),
      this.immichApi.getConnectionInfo(userId),
    ]);

    const linksByAlbumId = new Map<string, typeof links>();
    for (const link of links) {
      const bucket = linksByAlbumId.get(link.albumId) ?? [];
      bucket.push(link);
      linksByAlbumId.set(link.albumId, bucket);
    }

    const albums = immichAlbums.map((album) =>
      ImmichMapper.mapBrowseAlbum(
        album,
        linksByAlbumId.get(album.id) ?? [],
        this.buildAlbumWebUrl(info.baseUrl, album.id),
        album.thumbnailAssetId
          ? `/immich/asset/${album.thumbnailAssetId}/thumbnail`
          : null,
      ),
    );

    return { total: albums.length, albums };
  }

  /** Creates an empty Immich album (no assets, no entry). Useful to set up an
   *  album first and attach entries later. */
  async createEmptyAlbum(
    userId: string,
    dto: CreateEmptyAlbumDto,
  ): Promise<ImmichBrowseAlbumResponse> {
    const albumName = dto.albumName.trim();

    if (!albumName) {
      throw new BadRequestException('albumName is required');
    }

    const album = await this.immichApi.createAlbum(userId, albumName, []);
    const baseUrl = (await this.immichApi.getConnectionInfo(userId)).baseUrl;

    return ImmichMapper.mapBrowseAlbum(
      {
        id: album.id,
        albumName: album.albumName,
        assetCount: album.assetCount ?? 0,
        thumbnailAssetId: null,
      },
      [],
      this.buildAlbumWebUrl(baseUrl, album.id),
      null,
    );
  }

  /**
   * Dry-run: returns the assets that WOULD be added (no album is created), so
   * the frontend can show a preview/confirm step before committing.
   */
  async previewAlbum(
    userId: string,
    dto: PreviewImmichAlbumDto,
  ): Promise<ImmichAlbumPreviewResponse> {
    const source = dto.source ?? ImmichAlbumSource.EXPORT;

    const info = await this.immichApi.getConnectionInfo(userId);
    const libraryRoot = this.requireLibraryRoot(info.libraryPath);

    const { sourcePaths } = await this.resolveEntrySources(
      userId,
      dto.photoEntryId,
      source,
      libraryRoot,
      dto.astroObjectId,
    );

    const assets = await this.immichApi.getAssetsByFolders(userId, sourcePaths);

    return ImmichMapper.mapAlbumPreview({
      photoEntryId: dto.photoEntryId,
      source,
      folderPaths: sourcePaths,
      assets,
    });
  }

  getAssetThumbnail(
    userId: string,
    assetId: string,
    size?: ThumbnailSize,
  ): Promise<ImmichThumbnail> {
    const mediaSize =
      size === ThumbnailSize.preview
        ? AssetMediaSize.Preview
        : AssetMediaSize.Thumbnail;

    return this.immichApi.getAssetThumbnail(userId, assetId, mediaSize);
  }

  async createAlbum(
    userId: string,
    dto: CreateImmichAlbumDto,
  ): Promise<ImmichAlbumSyncResponse> {
    const source = dto.source ?? ImmichAlbumSource.EXPORT;

    const info = await this.immichApi.getConnectionInfo(userId);
    const libraryRoot = this.requireLibraryRoot(info.libraryPath);

    const { entry, sourcePaths } = await this.resolveEntrySources(
      userId,
      dto.photoEntryId,
      source,
      libraryRoot,
      dto.astroObjectId,
    );

    const assets = await this.immichApi.getAssetsByFolders(userId, sourcePaths);
    const assetIds = assets.map((asset) => asset.id);

    const albumName = dto.albumName?.trim() || entry.name;

    const album = await this.immichApi.createAlbum(userId, albumName, assetIds);
    const totalAlbumAssets = album.assetCount ?? assetIds.length;

    let record: PhotoEntryImmichAlbum;
    try {
      record = await this.prisma.photoEntryImmichAlbum.create({
        data: {
          photoEntryId: entry.id,
          albumId: album.id,
          albumName: album.albumName,
          source,
          astroObjectId: dto.astroObjectId ?? null,
          sourcePaths,
          lastSyncedAt: new Date(),
          lastAssetCount: totalAlbumAssets,
        },
      });
    } catch (error) {
      // Compensation: drop the just-created Immich album so we don't leave an
      // orphan album with no tracking record.
      await this.immichApi.deleteAlbum(userId, album.id).catch(() => undefined);
      throw error;
    }

    return ImmichMapper.mapAlbumSync({
      id: record.id,
      albumId: album.id,
      albumName: album.albumName,
      albumUrl: this.buildAlbumWebUrl(info.baseUrl, album.id),
      source,
      created: true,
      assetsFound: assetIds.length,
      assetsAdded: totalAlbumAssets,
      totalAlbumAssets,
      assets,
    });
  }

  /**
   * Attaches a photo entry's folder assets to an EXISTING Immich album (an
   * album can aggregate many entries). Records a tracking link.
   */
  async attachEntry(
    userId: string,
    albumId: string,
    dto: AttachEntryDto,
  ): Promise<ImmichAlbumSyncResponse> {
    const source = dto.source ?? ImmichAlbumSource.EXPORT;

    const info = await this.immichApi.getConnectionInfo(userId);
    const libraryRoot = this.requireLibraryRoot(info.libraryPath);

    // Resolve the target album (also validates it exists in Immich).
    const album = await this.immichApi.getAlbum(userId, albumId);

    const { sourcePaths } = await this.resolveEntrySources(
      userId,
      dto.photoEntryId,
      source,
      libraryRoot,
      dto.astroObjectId,
    );

    const assets = await this.immichApi.getAssetsByFolders(userId, sourcePaths);
    const foundIds = assets.map((asset) => asset.id);

    const existingIds = new Set(album.assets?.map((asset) => asset.id) ?? []);
    const idsToAdd = foundIds.filter((id) => !existingIds.has(id));
    const idsToAddSet = new Set(idsToAdd);
    const addedAssets = assets.filter((asset) => idsToAddSet.has(asset.id));

    const addedCount = await this.immichApi.addAssetsToAlbum(
      userId,
      albumId,
      idsToAdd,
    );

    const totalAlbumAssets = existingIds.size + addedCount;

    const record = await this.upsertLink({
      albumId,
      photoEntryId: dto.photoEntryId,
      source,
      astroObjectId: dto.astroObjectId ?? null,
      albumName: album.albumName,
      sourcePaths,
      lastAssetCount: totalAlbumAssets,
    });

    return ImmichMapper.mapAlbumSync({
      id: record.id,
      albumId,
      albumName: album.albumName,
      albumUrl: this.buildAlbumWebUrl(info.baseUrl, albumId),
      source,
      created: false,
      assetsFound: foundIds.length,
      assetsAdded: addedCount,
      totalAlbumAssets,
      assets: addedAssets,
    });
  }

  async refreshAlbum(
    userId: string,
    albumRecordId: string,
  ): Promise<ImmichAlbumSyncResponse> {
    const link = await this.findOwnedLinkOrThrow(userId, albumRecordId);

    const info = await this.immichApi.getConnectionInfo(userId);
    const libraryRoot = this.requireLibraryRoot(info.libraryPath);

    const { sourcePaths } = await this.resolveEntrySources(
      userId,
      link.photoEntryId,
      link.source,
      libraryRoot,
      link.astroObjectId ?? undefined,
    );

    const assets = await this.immichApi.getAssetsByFolders(userId, sourcePaths);
    const foundIds = assets.map((asset) => asset.id);

    const album = await this.immichApi.getAlbum(userId, link.albumId);
    const existingIds = new Set(album.assets?.map((asset) => asset.id) ?? []);

    const idsToAdd = foundIds.filter((id) => !existingIds.has(id));
    const idsToAddSet = new Set(idsToAdd);
    const addedAssets = assets.filter((asset) => idsToAddSet.has(asset.id));

    const addedCount = await this.immichApi.addAssetsToAlbum(
      userId,
      link.albumId,
      idsToAdd,
    );

    const totalAlbumAssets = existingIds.size + addedCount;

    await this.prisma.photoEntryImmichAlbum.update({
      where: { id: link.id },
      data: {
        albumName: album.albumName,
        sourcePaths,
        lastSyncedAt: new Date(),
        lastAssetCount: totalAlbumAssets,
      },
    });

    return ImmichMapper.mapAlbumSync({
      id: link.id,
      albumId: link.albumId,
      albumName: album.albumName,
      albumUrl: this.buildAlbumWebUrl(info.baseUrl, link.albumId),
      source: link.source,
      created: false,
      assetsFound: foundIds.length,
      assetsAdded: addedCount,
      totalAlbumAssets,
      assets: addedAssets,
    });
  }

  /**
   * Detaches a tracked link. By default also removes that entry's assets from
   * the Immich album — but keeps assets still contributed by OTHER tracked
   * links of the same album.
   */
  async detachEntry(
    userId: string,
    albumRecordId: string,
    removeAssets = true,
  ): Promise<ImmichAlbumDeletedResponse> {
    const link = await this.findOwnedLinkOrThrow(userId, albumRecordId);

    let removedAssets = 0;

    if (removeAssets) {
      const info = await this.immichApi.getConnectionInfo(userId);
      const libraryRoot = this.requireLibraryRoot(info.libraryPath);

      // Fetch Immich's folder list once and reuse it for every link below
      // (avoids an N+1 of getUniqueOriginalPaths per other link).
      const knownPaths = await this.immichApi.listUniqueFolderPaths(userId);

      const myIds = await this.resolveLinkAssetIds(
        userId,
        link,
        libraryRoot,
        knownPaths,
      );

      // Keep assets that other links of the same album still contribute.
      const otherLinks = await this.prisma.photoEntryImmichAlbum.findMany({
        where: {
          albumId: link.albumId,
          id: { not: link.id },
          photoEntry: { userId },
        },
      });

      const keep = new Set<string>();
      for (const other of otherLinks) {
        const otherIds = await this.resolveLinkAssetIds(
          userId,
          other,
          libraryRoot,
          knownPaths,
        );
        otherIds.forEach((id) => keep.add(id));
      }

      const toRemove = myIds.filter((id) => !keep.has(id));

      removedAssets = await this.immichApi.removeAssetsFromAlbum(
        userId,
        link.albumId,
        toRemove,
      );
    }

    await this.prisma.photoEntryImmichAlbum.delete({ where: { id: link.id } });

    return { id: link.id, removedAssets };
  }

  /** Deletes the whole album in Immich (NOT the underlying photos) and removes
   *  every tracking link we hold for it. */
  async deleteAlbum(
    userId: string,
    albumId: string,
  ): Promise<ImmichAlbumRemovedResponse> {
    await this.immichApi.deleteAlbum(userId, albumId);

    const { count } = await this.prisma.photoEntryImmichAlbum.deleteMany({
      where: { albumId, photoEntry: { userId } },
    });

    return { albumId, removedLinks: count };
  }

  // ----------------------------------------------------------------
  // Library (external library scan for RAW/RAF indexing)
  // ----------------------------------------------------------------

  async listLibraries(userId: string): Promise<ImmichLibraryListResponse> {
    const libraries = await this.immichApi.getLibraries(userId);

    const withStats = await Promise.all(
      libraries.map(async (library) => {
        const stats = await this.immichApi.getLibraryStatistics(
          userId,
          library.id,
        );
        return ImmichMapper.mapLibrary(library, stats);
      }),
    );

    return { total: withStats.length, libraries: withStats };
  }

  async scanLibrary(userId: string, libraryId: string): Promise<void> {
    await this.immichApi.scanLibrary(userId, libraryId);
  }

  // ----------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------

  private async upsertLink(data: {
    albumId: string;
    photoEntryId: string;
    source: ImmichAlbumSource;
    astroObjectId: string | null;
    albumName: string;
    sourcePaths: string[];
    lastAssetCount: number;
  }): Promise<PhotoEntryImmichAlbum> {
    const existing = await this.prisma.photoEntryImmichAlbum.findFirst({
      where: {
        albumId: data.albumId,
        photoEntryId: data.photoEntryId,
        source: data.source,
        astroObjectId: data.astroObjectId,
      },
    });

    if (existing) {
      return this.prisma.photoEntryImmichAlbum.update({
        where: { id: existing.id },
        data: {
          albumName: data.albumName,
          sourcePaths: data.sourcePaths,
          lastSyncedAt: new Date(),
          lastAssetCount: data.lastAssetCount,
        },
      });
    }

    return this.prisma.photoEntryImmichAlbum.create({
      data: {
        photoEntryId: data.photoEntryId,
        albumId: data.albumId,
        albumName: data.albumName,
        source: data.source,
        astroObjectId: data.astroObjectId,
        sourcePaths: data.sourcePaths,
        lastSyncedAt: new Date(),
        lastAssetCount: data.lastAssetCount,
      },
    });
  }

  /** Resolves the asset ids for a link's folder scope; returns [] if the
   *  entry's folders are gone (best-effort, used by detach overlap check). */
  private async resolveLinkAssetIds(
    userId: string,
    link: PhotoEntryImmichAlbum,
    libraryRoot: string,
    knownPaths?: string[],
  ): Promise<string[]> {
    try {
      const { sourcePaths } = await this.resolveEntrySources(
        userId,
        link.photoEntryId,
        link.source,
        libraryRoot,
        link.astroObjectId ?? undefined,
      );
      const assets = await this.immichApi.getAssetsByFolders(
        userId,
        sourcePaths,
        knownPaths,
      );
      return assets.map((asset) => asset.id);
    } catch {
      return [];
    }
  }

  private async assertEntryOwnership(
    userId: string,
    photoEntryId: string,
  ): Promise<void> {
    const entry = await this.prisma.photoEntry.findFirst({
      where: { id: photoEntryId, userId },
      select: { id: true },
    });

    if (!entry) {
      throw new NotFoundException('PhotoEntry not found');
    }
  }

  private async findOwnedLinkOrThrow(userId: string, linkId: string) {
    const link = await this.prisma.photoEntryImmichAlbum.findFirst({
      where: { id: linkId, photoEntry: { userId } },
    });

    if (!link) {
      throw new NotFoundException('Immich album link not found');
    }

    return link;
  }

  private async resolveEntrySources(
    userId: string,
    photoEntryId: string,
    source: ImmichAlbumSource,
    libraryRoot: string,
    astroObjectId?: string,
  ): Promise<EntrySources> {
    const entry = await this.prisma.photoEntry.findFirst({
      where: { id: photoEntryId, userId },
      include: { astroObjects: true },
    });

    if (!entry) {
      throw new NotFoundException('PhotoEntry not found');
    }

    const relativePaths: string[] = [];

    if (astroObjectId) {
      const astroLink = entry.astroObjects.find(
        (link) => link.astroObjectId === astroObjectId,
      );

      if (!astroLink) {
        throw new BadRequestException(
          'astroObjectId is not linked to this photo entry',
        );
      }

      if (astroLink.rootPath) {
        relativePaths.push(astroLink.rootPath);
      }
    } else {
      if (entry.rootPath) {
        relativePaths.push(entry.rootPath);
      }

      for (const link of entry.astroObjects) {
        if (link.rootPath) {
          relativePaths.push(link.rootPath);
        }
      }
    }

    if (relativePaths.length === 0) {
      throw new BadRequestException(
        'PhotoEntry has no created folders to sync; create folders first',
      );
    }

    const subfolder = ALBUM_SOURCE_SUBFOLDER[source];

    const sourcePaths = relativePaths.map((relativePath) => {
      const scoped = subfolder ? `${relativePath}/${subfolder}` : relativePath;
      return this.joinImmichPath(libraryRoot, scoped);
    });

    return { entry, sourcePaths };
  }

  /**
   * The external library root must be configured (per-user via /immich/config,
   * or the IMMICH_LIBRARY_PATH env fallback) before album paths can be built.
   */
  private requireLibraryRoot(libraryRoot: string | undefined): string {
    if (!libraryRoot) {
      throw new BadRequestException(
        'Immich library path is not configured; set it via PUT /immich/config',
      );
    }

    return libraryRoot;
  }

  private joinImmichPath(root: string, relativePath: string): string {
    const normalizedRelative = relativePath
      .replace(/\\/g, '/')
      .replace(/^[\\/]+/, '');

    return `${root}/${normalizedRelative}`;
  }

  private normalizeBaseUrl(value: string): string {
    const trimmed = value.trim().replace(/\/+$/, '');

    if (!/^https?:\/\//i.test(trimmed)) {
      throw new BadRequestException(
        'Immich base URL must start with http:// or https://',
      );
    }

    // Immich's REST API lives under /api. If the user pasted the bare web URL
    // (no path), append /api so the SDK doesn't hit the web frontend (which
    // returns a 406 "only returns text/html"). Custom paths are left as-is.
    try {
      const url = new URL(trimmed);

      if (url.pathname === '' || url.pathname === '/') {
        url.pathname = '/api';
        return url.toString().replace(/\/+$/, '');
      }
    } catch {
      // already validated as http(s) above; keep trimmed value
    }

    return trimmed;
  }

  private normalizeLibraryPath(value?: string): string | undefined {
    const trimmed = value?.trim().replace(/[\\/]+$/, '');
    return trimmed ? trimmed : undefined;
  }

  /**
   * Builds the clickable Immich web UI link for an album. The stored base URL
   * is the API endpoint (e.g. https://host/api); the web album page lives at
   * the origin (https://host/albums/:id), so the trailing /api is stripped.
   */
  private buildAlbumWebUrl(
    baseUrl: string | undefined,
    albumId: string,
  ): string {
    if (!baseUrl) {
      return '';
    }

    const origin = baseUrl.replace(/\/+$/, '').replace(/\/api$/i, '');
    return `${origin}/albums/${albumId}`;
  }
}
