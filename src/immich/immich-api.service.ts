import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConnectedServiceType } from '@prisma/client';
import {
  getServerVersion,
  createAlbum,
  getAlbumInfo,
  getAllAlbums,
  deleteAlbum,
  addAssetsToAlbum,
  removeAssetFromAlbum,
  getAssetsByOriginalPath,
  getUniqueOriginalPaths,
  getAllLibraries,
  getLibraryStatistics,
  scanLibrary,
  viewAsset,
  AssetMediaSize,
} from '@immich/sdk';

import { TokenService } from '../token/token.service';

export type ImmichApiAlbum = {
  id: string;
  albumName: string;
  assetCount?: number;
  assets?: { id: string }[];
};

export type ImmichApiAsset = {
  id: string;
  originalPath?: string;
  originalFileName?: string;
  type?: string;
  localDateTime?: string;
  thumbhash?: string | null;
};

export type ImmichThumbnail = {
  data: Buffer;
  contentType: string;
};

export type ImmichApiAlbumSummary = {
  id: string;
  albumName: string;
  assetCount: number;
  thumbnailAssetId: string | null;
};

export type ImmichApiLibrary = {
  id: string;
  name: string;
  importPaths: string[];
  exclusionPatterns: string[];
  assetCount: number;
  refreshedAt: string | null;
};

export type ImmichApiLibraryStats = {
  photos: number;
  videos: number;
  total: number;
  usage: number;
};

export type ImmichConnectionInfo = {
  configured: boolean;
  baseUrl?: string;
  libraryPath?: string;
};

export type ImmichPingResult = {
  connected: boolean;
  serverVersion?: string;
};

/** Per-call oazapfts options — overrides the SDK's global defaults so concurrent
 *  requests for different users never share credentials/baseUrl. */
type RequestOpts = {
  baseUrl: string;
  headers: Record<string, string>;
  signal?: AbortSignal;
};

/** Hard timeout for any single Immich HTTP call (so a hung server can't hang
 *  the request, e.g. the status ping on the settings page). */
const IMMICH_TIMEOUT_MS = 20000;

@Injectable()
export class ImmichApiService {
  private readonly logger = new Logger(ImmichApiService.name);

  constructor(
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
  ) {}

  async getServerVersion(userId: string): Promise<string | undefined> {
    const opts = await this.getRequestOpts(userId);

    try {
      const response = await getServerVersion(opts);
      return `${response.major}.${response.minor}.${response.patch}`;
    } catch (error) {
      this.handleError(error);
    }
  }

  /** Non-throwing connection check used by GET /immich/status. */
  async ping(userId: string): Promise<ImmichPingResult> {
    try {
      const serverVersion = await this.getServerVersion(userId);
      return { connected: true, serverVersion };
    } catch {
      return { connected: false };
    }
  }

  /** Reports whether credentials are saved + the resolved base URL / library
   *  path, without throwing when nothing is configured. */
  async getConnectionInfo(userId: string): Promise<ImmichConnectionInfo> {
    try {
      const token = await this.tokenService.getToken(
        userId,
        ConnectedServiceType.IMMICH,
      );

      return {
        configured: true,
        baseUrl: this.resolveBaseUrl(token.baseUrl),
        libraryPath: this.resolveLibraryPath(token.libraryPath),
      };
    } catch {
      return {
        configured: false,
        baseUrl: this.resolveBaseUrl(undefined),
        libraryPath: this.resolveLibraryPath(undefined),
      };
    }
  }

  async createAlbum(
    userId: string,
    albumName: string,
    assetIds: string[] = [],
  ): Promise<ImmichApiAlbum> {
    const opts = await this.getRequestOpts(userId);

    try {
      const response = await createAlbum(
        { createAlbumDto: { albumName, assetIds } },
        opts,
      );

      return {
        id: response.id,
        albumName: response.albumName,
        assetCount: response.assetCount,
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  async getAlbum(userId: string, albumId: string): Promise<ImmichApiAlbum> {
    const opts = await this.getRequestOpts(userId);

    try {
      const response = await getAlbumInfo({ id: albumId }, opts);

      return {
        id: response.id,
        albumName: response.albumName,
        assetCount: response.assetCount,
        assets: response.assets?.map((asset) => ({ id: asset.id })) ?? [],
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  /** Lists all albums in Immich (the real source of truth). */
  async getAllAlbums(userId: string): Promise<ImmichApiAlbumSummary[]> {
    const opts = await this.getRequestOpts(userId);

    try {
      const albums = await getAllAlbums({}, opts);

      return albums.map((album) => ({
        id: album.id,
        albumName: album.albumName,
        assetCount: album.assetCount,
        thumbnailAssetId: album.albumThumbnailAssetId,
      }));
    } catch (error) {
      this.handleError(error);
    }
  }

  /** Deletes an album in Immich (does NOT delete the underlying assets). */
  async deleteAlbum(userId: string, albumId: string): Promise<void> {
    const opts = await this.getRequestOpts(userId);

    try {
      await deleteAlbum({ id: albumId }, opts);
    } catch (error) {
      this.handleError(error);
    }
  }

  /** Adds assets to an album. Returns how many were actually added (Immich
   *  dedupes server-side, so this can be less than the input length). */
  async addAssetsToAlbum(
    userId: string,
    albumId: string,
    assetIds: string[],
  ): Promise<number> {
    if (!assetIds.length) return 0;

    const opts = await this.getRequestOpts(userId);

    try {
      const results = await addAssetsToAlbum(
        { id: albumId, bulkIdsDto: { ids: assetIds } },
        opts,
      );

      return results.filter((result) => result.success).length;
    } catch (error) {
      this.handleError(error);
    }
  }

  /** Removes assets from an album. Returns how many were actually removed. */
  async removeAssetsFromAlbum(
    userId: string,
    albumId: string,
    assetIds: string[],
  ): Promise<number> {
    if (!assetIds.length) return 0;

    const opts = await this.getRequestOpts(userId);

    try {
      const results = await removeAssetFromAlbum(
        { id: albumId, bulkIdsDto: { ids: assetIds } },
        opts,
      );

      return results.filter((result) => result.success).length;
    } catch (error) {
      this.handleError(error);
    }
  }

  async getLibraries(userId: string): Promise<ImmichApiLibrary[]> {
    const opts = await this.getRequestOpts(userId);

    try {
      const libraries = await getAllLibraries(opts);

      return libraries.map((library) => ({
        id: library.id,
        name: library.name,
        importPaths: library.importPaths,
        exclusionPatterns: library.exclusionPatterns,
        assetCount: library.assetCount,
        refreshedAt: library.refreshedAt,
      }));
    } catch (error) {
      this.handleError(error);
    }
  }

  async getLibraryStatistics(
    userId: string,
    libraryId: string,
  ): Promise<ImmichApiLibraryStats> {
    const opts = await this.getRequestOpts(userId);

    try {
      const stats = await getLibraryStatistics({ id: libraryId }, opts);

      return {
        photos: stats.photos,
        videos: stats.videos,
        total: stats.total,
        usage: stats.usage,
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  /** Triggers a (re)scan of an external library so Immich indexes new files. */
  async scanLibrary(userId: string, libraryId: string): Promise<void> {
    const opts = await this.getRequestOpts(userId);

    try {
      await scanLibrary({ id: libraryId }, opts);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Returns the assets under the given folders, **recursively** — the folder
   * itself plus every nested sub-folder (so 01_SOURCE also covers
   * 01_SOURCE/RAW, 01_SOURCE/JPEG, …). Immich's folder primitive is
   * non-recursive, so we expand targets against the library's full folder list
   * (`getUniqueOriginalPaths`) and fetch each matching leaf. A single unreadable
   * folder is skipped (best-effort) rather than failing the whole operation.
   */
  /** All unique folder paths Immich has indexed (used to expand targets
   *  recursively; can be fetched once and passed back in via `knownPaths`). */
  async listUniqueFolderPaths(userId: string): Promise<string[]> {
    const opts = await this.getRequestOpts(userId);

    try {
      return await getUniqueOriginalPaths(opts);
    } catch (error) {
      this.handleError(error);
    }
  }

  async getAssetsByFolders(
    userId: string,
    folderPaths: string[],
    knownPaths?: string[],
  ): Promise<ImmichApiAsset[]> {
    const opts = await this.getRequestOpts(userId);

    const targets = folderPaths.map((path) => path.replace(/\/+$/, ''));

    let allPaths: string[] = knownPaths ?? [];
    if (!knownPaths) {
      try {
        allPaths = await getUniqueOriginalPaths(opts);
      } catch (error) {
        this.handleError(error);
      }
    }

    const matched = allPaths.filter((path) =>
      targets.some(
        (target) => path === target || path.startsWith(`${target}/`),
      ),
    );

    const assets: ImmichApiAsset[] = [];

    for (const path of matched) {
      try {
        const items = await getAssetsByOriginalPath(
          { path },
          { ...opts, signal: this.timeoutSignal() },
        );

        assets.push(
          ...items.map((item) => ({
            id: item.id,
            originalPath: item.originalPath,
            originalFileName: item.originalFileName,
            type: item.type,
            localDateTime: item.localDateTime,
            thumbhash: item.thumbhash,
          })),
        );
      } catch (error) {
        // Best-effort: skip a folder Immich can't serve, keep the rest.
        this.logger.warn(
          `Immich: failed to read folder "${path}": ${(error as Error)?.message}`,
        );
      }
    }

    return this.deduplicateAssets(assets);
  }

  /**
   * Fetches a single asset's thumbnail bytes from Immich (proxied so the
   * frontend doesn't need the Immich API key).
   */
  async getAssetThumbnail(
    userId: string,
    assetId: string,
    size: AssetMediaSize = AssetMediaSize.Thumbnail,
  ): Promise<ImmichThumbnail> {
    const opts = await this.getRequestOpts(userId);

    try {
      const blob = await viewAsset({ id: assetId, size }, opts);
      const data = Buffer.from(await blob.arrayBuffer());

      return { data, contentType: blob.type || 'image/jpeg' };
    } catch (error) {
      this.handleError(error);
    }
  }

  // ----------------------------------------------------------------
  // Internals
  // ----------------------------------------------------------------

  /**
   * Builds per-call oazapfts options from the user's stored credentials. Using
   * per-call options (instead of the SDK's global `init`) prevents concurrent
   * requests for different users from clobbering each other's baseUrl / API key.
   */
  private async getRequestOpts(userId: string): Promise<RequestOpts> {
    const token = await this.tokenService.getToken(
      userId,
      ConnectedServiceType.IMMICH,
    );

    const baseUrl = this.resolveBaseUrl(token.baseUrl);

    if (!baseUrl) {
      throw new BadRequestException(
        'Immich base URL is not configured; save it via PUT /immich/config',
      );
    }

    return {
      baseUrl,
      headers: { 'x-api-key': token.value },
      signal: AbortSignal.timeout(IMMICH_TIMEOUT_MS),
    };
  }

  /** Fresh per-call timeout signal (used inside loops so each call gets its own
   *  window rather than sharing the operation's). */
  private timeoutSignal(): AbortSignal {
    return AbortSignal.timeout(IMMICH_TIMEOUT_MS);
  }

  private resolveBaseUrl(
    stored: string | null | undefined,
  ): string | undefined {
    const candidate =
      typeof stored === 'string' && stored.trim()
        ? stored
        : this.configService.get<string>('IMMICH_API_URL');

    const trimmed = candidate?.trim();
    return trimmed ? trimmed.replace(/\/+$/, '') : undefined;
  }

  private resolveLibraryPath(
    stored: string | null | undefined,
  ): string | undefined {
    const candidate =
      typeof stored === 'string' && stored.trim()
        ? stored
        : this.configService.get<string>('IMMICH_LIBRARY_PATH');

    const trimmed = candidate?.trim();
    return trimmed ? trimmed.replace(/[\\/]+$/, '') : undefined;
  }

  private deduplicateAssets(assets: ImmichApiAsset[]): ImmichApiAsset[] {
    const map = new Map<string, ImmichApiAsset>();

    for (const asset of assets) {
      map.set(asset.id, asset);
    }

    return Array.from(map.values());
  }

  private handleError(error: unknown): never {
    const e = error as {
      status?: number;
      message?: string;
      cause?: { message?: string; code?: string };
    };

    this.logger.error(
      `Immich API call failed: status=${e?.status ?? '?'} message=${
        e?.message ?? '?'
      } code=${e?.cause?.code ?? ''}`,
    );

    if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof error.message === 'string'
    ) {
      throw new BadGatewayException(error.message);
    }

    throw new InternalServerErrorException('Immich integration failed');
  }
}
