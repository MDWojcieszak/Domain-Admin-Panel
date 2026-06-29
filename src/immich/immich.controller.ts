import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { ImmichService } from './immich.service';
import {
  AttachEntryDto,
  CreateEmptyAlbumDto,
  CreateImmichAlbumDto,
  GetImmichAlbumsQueryDto,
  GetThumbnailQueryDto,
  PreviewImmichAlbumDto,
  SaveImmichConfigDto,
} from './dto';
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
import { GetCurrentUser, RequirePermissions } from '../common/decorators';
import { PERMISSIONS } from '../common/acl/permissions';

@Controller('immich')
@ApiTags('Immich')
export class ImmichController {
  constructor(private readonly immichService: ImmichService) {}

  // ----------------------------------------------------------------
  // Connection config
  // ----------------------------------------------------------------

  @RequirePermissions(PERMISSIONS.TOKEN_READ)
  @ApiBearerAuth()
  @Get('status')
  @ApiOkResponse({
    description: 'Immich connection status (live ping)',
    type: ImmichStatusResponse,
  })
  async getStatus(
    @GetCurrentUser('sub') userId: string,
  ): Promise<ImmichStatusResponse> {
    return this.immichService.getStatus(userId);
  }

  @RequirePermissions(PERMISSIONS.TOKEN_MANAGE)
  @ApiBearerAuth()
  @Put('config')
  @ApiOkResponse({
    description:
      'Save Immich connection config (URL + token + library) + verify',
    type: ImmichStatusResponse,
  })
  async saveConfig(
    @GetCurrentUser('sub') userId: string,
    @Body() dto: SaveImmichConfigDto,
  ): Promise<ImmichStatusResponse> {
    return this.immichService.saveConfig(userId, dto);
  }

  @RequirePermissions(PERMISSIONS.TOKEN_MANAGE)
  @ApiBearerAuth()
  @Delete('config')
  @ApiOkResponse({
    description: 'Remove the Immich connection config',
    type: ImmichStatusResponse,
  })
  async removeConfig(
    @GetCurrentUser('sub') userId: string,
  ): Promise<ImmichStatusResponse> {
    return this.immichService.removeConfig(userId);
  }

  // ----------------------------------------------------------------
  // Library (RAW/RAF indexing)
  // ----------------------------------------------------------------

  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_READ)
  @ApiBearerAuth()
  @Get('libraries')
  @ApiOkResponse({
    description: 'List Immich external libraries with statistics',
    type: ImmichLibraryListResponse,
  })
  async listLibraries(
    @GetCurrentUser('sub') userId: string,
  ): Promise<ImmichLibraryListResponse> {
    return this.immichService.listLibraries(userId);
  }

  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_MANAGE)
  @ApiBearerAuth()
  @Post('library/:id/scan')
  @ApiOkResponse({ description: 'Trigger a (re)scan of an Immich library' })
  async scanLibrary(
    @GetCurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ scheduled: true }> {
    await this.immichService.scanLibrary(userId, id);
    return { scheduled: true };
  }

  // ----------------------------------------------------------------
  // Albums
  // ----------------------------------------------------------------

  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_READ)
  @ApiBearerAuth()
  @Get('albums')
  @ApiOkResponse({
    description: 'Browse all Immich albums enriched with linked photo entries',
    type: ImmichAlbumBrowseResponse,
  })
  async browseAlbums(
    @GetCurrentUser('sub') userId: string,
  ): Promise<ImmichAlbumBrowseResponse> {
    return this.immichService.browseAlbums(userId);
  }

  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_READ)
  @ApiBearerAuth()
  @Get('album')
  @ApiOkResponse({
    description: 'List tracked album links (optionally by photo entry)',
    type: ImmichAlbumListResponse,
  })
  async listAlbums(
    @GetCurrentUser('sub') userId: string,
    @Query() query: GetImmichAlbumsQueryDto,
  ): Promise<ImmichAlbumListResponse> {
    return this.immichService.listAlbums(userId, query.photoEntryId);
  }

  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_READ)
  @ApiBearerAuth()
  @Post('album/preview')
  @ApiOkResponse({
    description: 'Preview assets that would be added to an album (no-op)',
    type: ImmichAlbumPreviewResponse,
  })
  async previewAlbum(
    @GetCurrentUser('sub') userId: string,
    @Body() dto: PreviewImmichAlbumDto,
  ): Promise<ImmichAlbumPreviewResponse> {
    return this.immichService.previewAlbum(userId, dto);
  }

  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_MANAGE)
  @ApiBearerAuth()
  @Post('album/create')
  @ApiOkResponse({
    description: 'Create a new Immich album from a photo entry folder',
    type: ImmichAlbumSyncResponse,
  })
  async createAlbum(
    @GetCurrentUser('sub') userId: string,
    @Body() dto: CreateImmichAlbumDto,
  ): Promise<ImmichAlbumSyncResponse> {
    return this.immichService.createAlbum(userId, dto);
  }

  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_MANAGE)
  @ApiBearerAuth()
  @Post('album/empty')
  @ApiOkResponse({
    description: 'Create an empty Immich album (attach entries later)',
    type: ImmichBrowseAlbumResponse,
  })
  async createEmptyAlbum(
    @GetCurrentUser('sub') userId: string,
    @Body() dto: CreateEmptyAlbumDto,
  ): Promise<ImmichBrowseAlbumResponse> {
    return this.immichService.createEmptyAlbum(userId, dto);
  }

  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_MANAGE)
  @ApiBearerAuth()
  @Post('album/:albumId/attach')
  @ApiOkResponse({
    description: 'Attach a photo entry folder to an existing Immich album',
    type: ImmichAlbumSyncResponse,
  })
  async attachEntry(
    @GetCurrentUser('sub') userId: string,
    @Param('albumId', ParseUUIDPipe) albumId: string,
    @Body() dto: AttachEntryDto,
  ): Promise<ImmichAlbumSyncResponse> {
    return this.immichService.attachEntry(userId, albumId, dto);
  }

  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_MANAGE)
  @ApiBearerAuth()
  @Delete('album/:albumId')
  @ApiOkResponse({
    description:
      'Delete the whole album in Immich (keeps the photos) + remove our links',
    type: ImmichAlbumRemovedResponse,
  })
  async deleteAlbum(
    @GetCurrentUser('sub') userId: string,
    @Param('albumId', ParseUUIDPipe) albumId: string,
  ): Promise<ImmichAlbumRemovedResponse> {
    return this.immichService.deleteAlbum(userId, albumId);
  }

  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_MANAGE)
  @ApiBearerAuth()
  @Post('album/link/:id/refresh')
  @ApiOkResponse({
    description: 'Refresh a tracked link with newly added assets',
    type: ImmichAlbumSyncResponse,
  })
  async refreshAlbum(
    @GetCurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ImmichAlbumSyncResponse> {
    return this.immichService.refreshAlbum(userId, id);
  }

  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_MANAGE)
  @ApiBearerAuth()
  @Delete('album/link/:id')
  @ApiQuery({
    name: 'removeAssets',
    required: false,
    type: Boolean,
    description:
      'Also remove this entry’s assets from the Immich album (default true)',
  })
  @ApiOkResponse({
    description:
      'Detach a tracked link (optionally remove the entry assets from the album)',
    type: ImmichAlbumDeletedResponse,
  })
  async detachEntry(
    @GetCurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('removeAssets', new DefaultValuePipe(true), ParseBoolPipe)
    removeAssets: boolean,
  ): Promise<ImmichAlbumDeletedResponse> {
    return this.immichService.detachEntry(userId, id, removeAssets);
  }

  // ----------------------------------------------------------------
  // Asset thumbnails (proxy)
  // ----------------------------------------------------------------

  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_READ)
  @ApiBearerAuth()
  @Get('asset/:id/thumbnail')
  @ApiOkResponse({ description: 'Asset thumbnail image (binary stream)' })
  async getAssetThumbnail(
    @GetCurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: GetThumbnailQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { data, contentType } = await this.immichService.getAssetThumbnail(
      userId,
      id,
      query.size,
    );

    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=86400',
    });

    return new StreamableFile(data);
  }
}
