import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConnectedServiceType } from '@prisma/client';
import {
  init,
  getServerVersion,
  createAlbum,
  getAlbumInfo,
  addAssetsToAlbum,
  searchAssets,
} from '@immich/sdk';

import { TokenService } from '../token/token.service';

const SEARCH_PAGE_SIZE = 1000;
const MAX_SEARCH_PAGES = 100;

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
};

@Injectable()
export class ImmichApiService {
  constructor(
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
  ) {}

  async getServerVersion(userId: string): Promise<string | undefined> {
    await this.configure(userId);

    try {
      const response = await getServerVersion();
      return `${response.major}.${response.minor}.${response.patch}`;
    } catch (error) {
      this.handleError(error);
    }
  }

  async createAlbum(
    userId: string,
    albumName: string,
    assetIds: string[] = [],
  ): Promise<ImmichApiAlbum> {
    await this.configure(userId);

    try {
      const response = await createAlbum({
        createAlbumDto: {
          albumName,
          assetIds,
        },
      });

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
    await this.configure(userId);

    try {
      const response = await getAlbumInfo({ id: albumId });

      return {
        id: response.id,
        albumName: response.albumName,
        assetCount: response.assetCount,
        assets:
          response.assets?.map((asset) => ({
            id: asset.id,
          })) ?? [],
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  async addAssetsToAlbum(
    userId: string,
    albumId: string,
    assetIds: string[],
  ): Promise<void> {
    if (!assetIds.length) return;

    await this.configure(userId);

    try {
      await addAssetsToAlbum({
        id: albumId,
        bulkIdsDto: {
          ids: assetIds,
        },
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  async searchAssetsByPathPrefixes(
    userId: string,
    pathPrefixes: string[],
  ): Promise<ImmichApiAsset[]> {
    await this.configure(userId);

    const assets: ImmichApiAsset[] = [];

    for (const pathPrefix of pathPrefixes) {
      let page = 1;

      try {
        while (page <= MAX_SEARCH_PAGES) {
          const response = await searchAssets({
            metadataSearchDto: {
              originalPath: pathPrefix,
              page,
              size: SEARCH_PAGE_SIZE,
            },
          });

          const items = response.assets?.items ?? [];

          assets.push(
            ...items.map((item) => ({
              id: item.id,
              originalPath: item.originalPath,
              originalFileName: item.originalFileName,
            })),
          );

          const nextPage = response.assets?.nextPage;
          if (!nextPage) break;

          page = Number(nextPage) || page + 1;
        }
      } catch (error) {
        this.handleError(error);
      }
    }

    return this.deduplicateAssets(assets);
  }

  private async configure(userId: string): Promise<void> {
    const token = await this.tokenService.getToken(
      userId,
      ConnectedServiceType.IMMICH,
    );

    const baseUrl = this.getBaseUrl();

    init({
      baseUrl,
      apiKey: token.value,
    });
  }

  private getBaseUrl(): string {
    const value = this.configService.get<string>('IMMICH_API_URL')?.trim();

    if (!value) {
      throw new BadRequestException('IMMICH_API_URL is missing');
    }

    return value.replace(/\/$/, '');
  }

  private deduplicateAssets(assets: ImmichApiAsset[]): ImmichApiAsset[] {
    const map = new Map<string, ImmichApiAsset>();

    for (const asset of assets) {
      map.set(asset.id, asset);
    }

    return Array.from(map.values());
  }

  private handleError(error: unknown): never {
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
