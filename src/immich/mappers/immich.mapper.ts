import { ImmichAlbumSource, PhotoEntryImmichAlbum } from '@prisma/client';

import {
  ImmichApiAsset,
  ImmichApiAlbumSummary,
  ImmichApiLibrary,
  ImmichApiLibraryStats,
} from '../immich-api.service';
import {
  ImmichStatusResponse,
  ImmichAlbumResponse,
  ImmichAlbumSyncResponse,
  ImmichAlbumItemResponse,
  ImmichAssetPreviewResponse,
  ImmichAlbumPreviewResponse,
  ImmichAlbumEntryLinkResponse,
  ImmichBrowseAlbumResponse,
  ImmichLibraryResponse,
} from '../responses';

export class ImmichMapper {
  static mapAlbumEntryLink(
    record: PhotoEntryImmichAlbum,
  ): ImmichAlbumEntryLinkResponse {
    return {
      id: record.id,
      photoEntryId: record.photoEntryId,
      source: record.source,
      astroObjectId: record.astroObjectId,
      lastAssetCount: record.lastAssetCount,
      lastSyncedAt: record.lastSyncedAt,
      createdAt: record.createdAt,
    };
  }

  static mapBrowseAlbum(
    album: ImmichApiAlbumSummary,
    links: PhotoEntryImmichAlbum[],
    albumUrl: string,
    thumbnailUrl: string | null,
  ): ImmichBrowseAlbumResponse {
    return {
      albumId: album.id,
      albumName: album.albumName,
      assetCount: album.assetCount,
      albumUrl,
      thumbnailUrl,
      entries: links.map((link) => this.mapAlbumEntryLink(link)),
    };
  }

  static mapLibrary(
    library: ImmichApiLibrary,
    stats: ImmichApiLibraryStats,
  ): ImmichLibraryResponse {
    return {
      id: library.id,
      name: library.name,
      importPaths: library.importPaths,
      exclusionPatterns: library.exclusionPatterns,
      assetCount: library.assetCount,
      refreshedAt: library.refreshedAt,
      photos: stats.photos,
      videos: stats.videos,
      total: stats.total,
      usage: stats.usage,
    };
  }
  static mapAssetPreview(asset: ImmichApiAsset): ImmichAssetPreviewResponse {
    return {
      id: asset.id,
      originalFileName: asset.originalFileName,
      type: asset.type,
      localDateTime: asset.localDateTime,
      thumbhash: asset.thumbhash ?? null,
      thumbnailUrl: `/immich/asset/${asset.id}/thumbnail`,
    };
  }

  static mapAlbumPreview(data: {
    photoEntryId: string;
    source: ImmichAlbumSource;
    folderPaths: string[];
    assets: ImmichApiAsset[];
  }): ImmichAlbumPreviewResponse {
    return {
      photoEntryId: data.photoEntryId,
      source: data.source,
      folderPaths: data.folderPaths,
      total: data.assets.length,
      assets: data.assets.map((asset) => this.mapAssetPreview(asset)),
    };
  }
  static mapAlbum(data: {
    id: string;
    albumName: string;
    assetCount?: number | null;
  }): ImmichAlbumResponse {
    return {
      id: data.id,
      albumName: data.albumName,
      assetCount: data.assetCount ?? 0,
    };
  }

  static mapAlbumSync(data: {
    id: string;
    albumId: string;
    albumName: string;
    albumUrl: string;
    source: ImmichAlbumSource;
    created: boolean;
    assetsFound: number;
    assetsAdded: number;
    totalAlbumAssets: number;
    assets: ImmichApiAsset[];
  }): ImmichAlbumSyncResponse {
    return {
      id: data.id,
      albumId: data.albumId,
      albumName: data.albumName,
      albumUrl: data.albumUrl,
      source: data.source,
      created: data.created,
      assetsFound: data.assetsFound,
      assetsAdded: data.assetsAdded,
      totalAlbumAssets: data.totalAlbumAssets,
      assets: data.assets.map((asset) => this.mapAssetPreview(asset)),
    };
  }

  static mapAlbumItem(
    record: PhotoEntryImmichAlbum,
    albumUrl: string,
  ): ImmichAlbumItemResponse {
    return {
      id: record.id,
      photoEntryId: record.photoEntryId,
      albumId: record.albumId,
      albumName: record.albumName,
      albumUrl,
      source: record.source,
      astroObjectId: record.astroObjectId,
      lastAssetCount: record.lastAssetCount,
      lastSyncedAt: record.lastSyncedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  static mapStatus(data: {
    configured: boolean;
    connected: boolean;
    serverVersion?: string;
    baseUrl?: string;
    libraryPath?: string;
  }): ImmichStatusResponse {
    return {
      configured: data.configured,
      connected: data.connected,
      serverVersion: data.serverVersion,
      baseUrl: data.baseUrl,
      libraryPath: data.libraryPath,
    };
  }
}
