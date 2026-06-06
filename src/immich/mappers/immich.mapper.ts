import {
  ImmichStatusResponse,
  ImmichAlbumResponse,
  ImmichAlbumSyncResponse,
} from '../responses';

export class ImmichMapper {
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
    albumId: string;
    albumName: string;
    created: boolean;
    assetsFound: number;
    assetsAdded: number;
    totalAlbumAssets: number;
  }): ImmichAlbumSyncResponse {
    return {
      albumId: data.albumId,
      albumName: data.albumName,
      created: data.created,
      assetsFound: data.assetsFound,
      assetsAdded: data.assetsAdded,
      totalAlbumAssets: data.totalAlbumAssets,
    };
  }

  static mapStatus(data: {
    connected: boolean;
    serverVersion?: string;
    baseUrl?: string;
  }): ImmichStatusResponse {
    return {
      connected: data.connected,
      serverVersion: data.serverVersion,
      baseUrl: data.baseUrl,
    };
  }
}
