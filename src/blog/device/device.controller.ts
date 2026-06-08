import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { GetCurrentUser } from '../../common/decorators';
import { DeviceService } from './device.service';
import { GetDevicesQueryDto, RegisterDeviceDto } from './dto';
import {
  DeviceListResponse,
  DeviceResponse,
  DeviceWithLicenseResponse,
  LicenseResponse,
} from './responses';

/** All routes are the caller's OWN devices (authenticated; no special permission). */
@Controller('blog/devices')
@ApiTags('Blog · App devices')
@ApiBearerAuth()
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @Post('register')
  @ApiOkResponse({
    description: 'Activated/renewed device + fresh license',
    type: DeviceWithLicenseResponse,
  })
  async register(
    @GetCurrentUser('sub') userId: string,
    @Body() dto: RegisterDeviceDto,
  ): Promise<DeviceWithLicenseResponse> {
    return this.deviceService.register(userId, dto);
  }

  @Get()
  @ApiOkResponse({ description: 'My devices', type: DeviceListResponse })
  async list(
    @GetCurrentUser('sub') userId: string,
    @Query() query: GetDevicesQueryDto,
  ): Promise<DeviceListResponse> {
    return this.deviceService.listMine(userId, query);
  }

  @Get(':id/license')
  @ApiOkResponse({ description: 'Re-issued license', type: LicenseResponse })
  async fetchLicense(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<LicenseResponse> {
    return this.deviceService.fetchLicense(userId, id);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'My device detail', type: DeviceResponse })
  async get(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<DeviceResponse> {
    return this.deviceService.getMine(userId, id);
  }

  @Delete(':id')
  @ApiOkResponse({ description: 'Revoked device', type: DeviceResponse })
  async revoke(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<DeviceResponse> {
    return this.deviceService.revoke(userId, id);
  }
}
