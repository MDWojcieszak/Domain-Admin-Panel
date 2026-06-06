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
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { PhotoEntryService } from './photo-entry.service';
import {
  CreatePhotoEntryDto,
  GetPhotoEntriesQueryDto,
  PatchPhotoEntryDto,
  PatchPhotoEntryStatusDto,
} from './dto';
import {
  PhotoEntryDetailsResponse,
  PhotoEntryListResponse,
  PhotoEntryResponse,
} from './responses';
import { GetCurrentUser, Roles } from '../common/decorators';

@Controller('photo-entry')
@ApiTags('Photo Entry')
export class PhotoEntryController {
  constructor(private readonly photoEntryService: PhotoEntryService) {}

  @ApiBearerAuth()
  @Roles('OWNER')
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
  @Roles('OWNER')
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
  @Roles('OWNER')
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
  @Roles('OWNER')
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
  @Roles('OWNER')
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
  @Roles('OWNER')
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
  @Roles('OWNER')
  @Post(':id/mark-media-uploaded')
  @ApiOkResponse({
    description: 'Created photo entry folders',
    type: PhotoEntryResponse,
  })
  async markMediaUploaded(
    @Param('id') id: string,
  ): Promise<PhotoEntryResponse> {
    return this.photoEntryService.markMediaUploaded(id);
  }

  @ApiBearerAuth()
  @Roles('OWNER')
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
