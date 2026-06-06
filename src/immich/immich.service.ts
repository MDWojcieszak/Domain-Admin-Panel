import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConnectedServiceType, PhotoEntry } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from '../token/token.service';

import { ImmichApiService } from './immich-api.service';
import { CreateImmichAlbumDto, RefreshImmichAlbumDto } from './dto';
import { ImmichMapper } from './mappers';
import { ImmichAlbumSyncResponse, ImmichStatusResponse } from './responses';

type EntrySources = {
  entry: PhotoEntry;
  sourcePaths: string[];
};

@Injectable()
export class ImmichService {
  constructor(
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly immichApi: ImmichApiService,
  ) {}

  async getStatus(userId: string): Promise<ImmichStatusResponse> {
    const token = await this.tokenService.getToken(
      userId,
      ConnectedServiceType.IMMICH,
    );

    const meta =
      token.meta && typeof token.meta === 'object'
        ? (token.meta as Record<string, unknown>)
        : undefined;

    const baseUrl =
      typeof meta?.baseUrl === 'string' ? meta.baseUrl : undefined;

    return ImmichMapper.mapStatus({
      connected: true,
      baseUrl,
    });
  }

  async createAlbum(
    userId: string,
    dto: CreateImmichAlbumDto,
  ): Promise<ImmichAlbumSyncResponse> {
    const { entry, sourcePaths } = await this.resolveEntrySources(
      userId,
      dto.photoEntryId,
    );

    const existing = await this.prisma.photoEntryImmichAlbum.findUnique({
      where: { photoEntryId: entry.id },
    });

    if (existing) {
      throw new ConflictException(
        'Immich album already exists for this photo entry; use refresh instead',
      );
    }

    const assets = await this.immichApi.searchAssetsByPathPrefixes(
      userId,
      sourcePaths,
    );
    const assetIds = assets.map((asset) => asset.id);

    const album = await this.immichApi.createAlbum(
      userId,
      entry.name,
      assetIds,
    );

    const totalAlbumAssets = album.assetCount ?? assetIds.length;

    await this.prisma.photoEntryImmichAlbum.create({
      data: {
        photoEntryId: entry.id,
        albumId: album.id,
        albumName: album.albumName,
        sourcePaths,
        lastSyncedAt: new Date(),
        lastAssetCount: totalAlbumAssets,
      },
    });

    return ImmichMapper.mapAlbumSync({
      albumId: album.id,
      albumName: album.albumName,
      created: true,
      assetsFound: assetIds.length,
      assetsAdded: assetIds.length,
      totalAlbumAssets,
    });
  }

  async refreshAlbum(
    userId: string,
    dto: RefreshImmichAlbumDto,
  ): Promise<ImmichAlbumSyncResponse> {
    const { entry, sourcePaths } = await this.resolveEntrySources(
      userId,
      dto.photoEntryId,
    );

    const link = await this.prisma.photoEntryImmichAlbum.findUnique({
      where: { photoEntryId: entry.id },
    });

    if (!link) {
      throw new NotFoundException(
        'Immich album for this photo entry does not exist; create it first',
      );
    }

    const assets = await this.immichApi.searchAssetsByPathPrefixes(
      userId,
      sourcePaths,
    );
    const foundIds = assets.map((asset) => asset.id);

    const album = await this.immichApi.getAlbum(userId, link.albumId);
    const existingIds = new Set(album.assets?.map((asset) => asset.id) ?? []);

    const idsToAdd = foundIds.filter((id) => !existingIds.has(id));

    await this.immichApi.addAssetsToAlbum(userId, link.albumId, idsToAdd);

    const totalAlbumAssets =
      (album.assetCount ?? existingIds.size) + idsToAdd.length;

    await this.prisma.photoEntryImmichAlbum.update({
      where: { photoEntryId: entry.id },
      data: {
        albumName: album.albumName,
        sourcePaths,
        lastSyncedAt: new Date(),
        lastAssetCount: totalAlbumAssets,
      },
    });

    return ImmichMapper.mapAlbumSync({
      albumId: link.albumId,
      albumName: album.albumName,
      created: false,
      assetsFound: foundIds.length,
      assetsAdded: idsToAdd.length,
      totalAlbumAssets,
    });
  }

  private async resolveEntrySources(
    userId: string,
    photoEntryId: string,
  ): Promise<EntrySources> {
    const entry = await this.prisma.photoEntry.findFirst({
      where: { id: photoEntryId, userId },
      include: { astroObjects: true },
    });

    if (!entry) {
      throw new NotFoundException('PhotoEntry not found');
    }

    const relativePaths: string[] = [];

    if (entry.rootPath) {
      relativePaths.push(entry.rootPath);
    }

    for (const link of entry.astroObjects) {
      if (link.rootPath) {
        relativePaths.push(link.rootPath);
      }
    }

    if (relativePaths.length === 0) {
      throw new BadRequestException(
        'PhotoEntry has no created folders to sync; create folders first',
      );
    }

    const libraryRoot = this.getLibraryRoot();
    const sourcePaths = relativePaths.map((relativePath) =>
      this.joinImmichPath(libraryRoot, relativePath),
    );

    return { entry, sourcePaths };
  }

  private getLibraryRoot(): string {
    const value = this.configService
      .get<string>('IMMICH_LIBRARY_PATH')
      ?.trim();

    if (!value) {
      throw new BadRequestException('IMMICH_LIBRARY_PATH is missing');
    }

    return value.replace(/[\\/]+$/, '');
  }

  private joinImmichPath(root: string, relativePath: string): string {
    const normalizedRelative = relativePath
      .replace(/\\/g, '/')
      .replace(/^[\\/]+/, '');

    return `${root}/${normalizedRelative}`;
  }
}
