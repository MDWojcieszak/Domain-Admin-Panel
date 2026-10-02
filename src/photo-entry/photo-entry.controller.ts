import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { PhotoEntryService } from './photo-entry.service';
import { PhotoEntryMapper } from './mappers';
import { PhotoEntryGearService } from './gear/photo-entry-gear.service';
import { PhotoEntryCountsService } from './counts/photo-entry-counts.service';
import {
  CreatePhotoEntryDto,
  GetPhotoEntriesQueryDto,
  PatchPhotoEntryDto,
  PatchPhotoEntryPostStageDto,
  PatchPhotoEntryProgressDto,
  PatchPhotoEntryStatusDto,
} from './dto';
import {
  PhotoEntryDetailsResponse,
  PhotoEntryFolderStructureResponse,
  PhotoEntryListResponse,
  PhotoEntryResponse,
} from './responses';
import { GetCurrentUser, RequirePermissions } from '../common/decorators';
import { PERMISSIONS } from '../common/acl/permissions';

@Controller('photo-entry')
@ApiTags('Photo Entry')
export class PhotoEntryController {
  constructor(
    private readonly photoEntryService: PhotoEntryService,
    private readonly photoEntryGearService: PhotoEntryGearService,
    private readonly photoEntryCountsService: PhotoEntryCountsService,
  ) {}

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_READ)
  @Get()
  @ApiOkResponse({
    description: 'List photo entries',
    type: PhotoEntryListResponse,
  })
  async list(
    @GetCurrentUser('sub') userId: string,
    @Query() query: GetPhotoEntriesQueryDto,
  ): Promise<PhotoEntryListResponse> {
    return this.photoEntryService.list(userId, query);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_READ)
  @Get(':id')
  @ApiOkResponse({
    description: 'Photo entry details',
    type: PhotoEntryDetailsResponse,
  })
  async getById(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<PhotoEntryDetailsResponse> {
    return this.photoEntryService.getById(userId, id);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_READ)
  @Get(':id/folder-structure')
  @ApiOperation({
    summary: 'Folder layout of a single entry',
    description:
      'For external tools that create or mirror the entry folders themselves. ' +
      'Returns the entry root folder plus the sub-folders to create under it, ' +
      'each tagged with a stable `role` — match on the role, not on the path. ' +
      'GENERAL and WORK entries only: ASTRO entries are filed per astro object ' +
      'and have no single root.',
  })
  @ApiOkResponse({
    description: 'Entry root folder and its sub-folder structure',
    type: PhotoEntryFolderStructureResponse,
  })
  async getFolderStructure(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<PhotoEntryFolderStructureResponse> {
    return this.photoEntryService.getFolderStructure(userId, id);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_MANAGE)
  @Post()
  @ApiOkResponse({
    description: 'Created photo entry',
    type: PhotoEntryResponse,
  })
  async create(
    @GetCurrentUser('sub') userId: string,
    @Body() dto: CreatePhotoEntryDto,
  ): Promise<PhotoEntryResponse> {
    return this.photoEntryService.create(userId, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_MANAGE)
  @Patch(':id')
  @ApiOkResponse({
    description: 'Patched photo entry',
    type: PhotoEntryResponse,
  })
  async patch(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: PatchPhotoEntryDto,
  ): Promise<PhotoEntryResponse> {
    return this.photoEntryService.patch(userId, id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_MANAGE)
  @Patch(':id/status')
  @ApiOkResponse({
    description: 'Patched photo entry status',
    type: PhotoEntryResponse,
  })
  async patchStatus(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: PatchPhotoEntryStatusDto,
  ): Promise<PhotoEntryResponse> {
    return this.photoEntryService.patchStatus(userId, id, dto);
  }

  @ApiBearerAuth()
  /**
   * The post-processing axis, independent of the shoot's status (D1). Most
   * entries legitimately stay at NONE — that is a resting state, not a to-do.
   */
  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_MANAGE)
  @Patch(':id/post-stage')
  @ApiOkResponse({ type: PhotoEntryResponse })
  async patchPostStage(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: PatchPhotoEntryPostStageDto,
  ): Promise<PhotoEntryResponse> {
    return this.photoEntryService.patchPostStage(userId, id, dto);
  }

  /**
   * Progress counts (§7) — entry level, never per photo. Written by hand from
   * the panel or by the culling app; both are equal callers.
   */
  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_MANAGE)
  @Patch(':id/progress')
  @ApiOkResponse({ type: PhotoEntryResponse })
  async patchProgress(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: PatchPhotoEntryProgressDto,
  ): Promise<PhotoEntryResponse> {
    return this.photoEntryService.patchProgress(userId, id, dto);
  }

  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_MANAGE)
  @Post(':id/create-folders')
  @ApiOkResponse({
    description: 'Created photo entry folders',
    type: PhotoEntryResponse,
  })
  async createFolders(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<PhotoEntryResponse> {
    return this.photoEntryService.createFolders(userId, id);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_MANAGE)
  @Post(':id/mark-media-uploaded')
  @ApiOperation({
    summary: 'Mark all media as secured',
    description:
      'Shortcut for "everything is offloaded": secures every used gear row that ' +
      'produces media and declares the gear, then derives uploadStatus.',
  })
  @ApiOkResponse({
    description: 'Photo entry with media marked as uploaded',
    type: PhotoEntryResponse,
  })
  async markMediaUploaded(
    @Param('id') id: string,
  ): Promise<PhotoEntryResponse> {
    const marked = await this.photoEntryGearService.markMediaUploaded(id);
    // The uploader has just copied the source in, so this is the moment the
    // photo count is worth reading off the disk.
    const recounted =
      await this.photoEntryCountsService.refreshAutomatically(id);
    return recounted ? PhotoEntryMapper.toResponse(recounted) : marked;
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_MANAGE)
  @Post(':id/refresh-counts')
  @ApiOperation({
    summary: 'Count photos from the entry folders',
    description:
      'photoCount from SOURCE (RAW+JPEG pairs count once; VIDEO and SEQUENCES ' +
      'excluded), selectedCount from SELECTS, editedCount from EXPORT. A stage ' +
      'holding fewer frames than the next one is reported as unknown. Always ' +
      'applies; the nightly run instead keeps counts reported after the folders ' +
      'last changed. GENERAL and WORK entries with created folders only.',
  })
  @ApiOkResponse({ type: PhotoEntryResponse })
  async refreshCounts(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<PhotoEntryResponse> {
    return this.photoEntryCountsService.refresh(userId, id);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_MANAGE)
  @Delete(':id')
  @ApiOkResponse({
    description: 'Deleted photo entry',
    type: PhotoEntryResponse,
  })
  async delete(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<PhotoEntryResponse> {
    return this.photoEntryService.delete(userId, id);
  }
}
