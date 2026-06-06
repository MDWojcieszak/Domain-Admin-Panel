import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { ImmichService } from './immich.service';
import { CreateImmichAlbumDto, RefreshImmichAlbumDto } from './dto';
import { ImmichAlbumSyncResponse, ImmichStatusResponse } from './responses';
import { GetCurrentUser } from '../common/decorators';

@Controller('immich')
@ApiTags('Immich')
export class ImmichController {
  constructor(private readonly immichService: ImmichService) {}

  @ApiBearerAuth()
  @Get('status')
  @ApiOkResponse({
    description: 'Immich connection status',
    type: ImmichStatusResponse,
  })
  async getStatus(
    @GetCurrentUser('sub') userId: string,
  ): Promise<ImmichStatusResponse> {
    return this.immichService.getStatus(userId);
  }

  @ApiBearerAuth()
  @Post('album/create')
  @ApiOkResponse({
    description: 'Created Immich album',
    type: ImmichAlbumSyncResponse,
  })
  async createAlbum(
    @GetCurrentUser('sub') userId: string,
    @Body() dto: CreateImmichAlbumDto,
  ): Promise<ImmichAlbumSyncResponse> {
    return this.immichService.createAlbum(userId, dto);
  }

  @ApiBearerAuth()
  @Post('album/refresh')
  @ApiOkResponse({
    description: 'Refreshed Immich album',
    type: ImmichAlbumSyncResponse,
  })
  async refreshAlbum(
    @GetCurrentUser('sub') userId: string,
    @Body() dto: RefreshImmichAlbumDto,
  ): Promise<ImmichAlbumSyncResponse> {
    return this.immichService.refreshAlbum(userId, dto);
  }
}
