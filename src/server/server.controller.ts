import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ServerService } from './server.service';
import {
  GetCurrentUser,
  Public,
  RequirePermissions,
} from '../common/decorators';
import { PERMISSIONS } from '../common/acl/permissions';
import { MessagePattern } from '@nestjs/microservices';
import {
  CreateCategoryDto,
  HeartbeatDto,
  PatchDiskDto,
  RegisterServerDto,
} from './dto';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  PowerServerResponseDto,
  ServerDetailsResponseDto,
  ServerListResponseDto,
  ServerResponseDto,
} from './responses';
import { PaginationDto } from '../common/dto';
import { UpdateServerPropertiesDto } from './dto/updateServerProperties.dto';
import { PatchCategoryDto } from './dto/patch-category.dto';
import { ServerPowerService } from './server-power.service';

@ApiTags('Server')
@Controller('server')
export class ServerController {
  constructor(
    private serverService: ServerService,
    private serverPower: ServerPowerService,
  ) {}

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.SERVER_READ)
  @Get('all')
  @ApiOkResponse({ type: ServerListResponseDto })
  async getAll(@Query() dto: PaginationDto): Promise<ServerListResponseDto> {
    return this.serverService.handleGetAll(dto);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.SERVER_READ)
  @Get(':serverId')
  @ApiOkResponse({ type: ServerResponseDto })
  async get(@Param('serverId') serverId: string): Promise<ServerResponseDto> {
    return this.serverService.handleGet(serverId);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.SERVER_READ)
  @Get('details/:serverId')
  @ApiOkResponse({ type: ServerDetailsResponseDto })
  async getDetails(
    @Param('serverId') serverId: string,
  ): Promise<ServerDetailsResponseDto> {
    return this.serverService.handleGetDetails(serverId);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.SERVER_POWER)
  @Patch(':serverId/start')
  @ApiOkResponse({ type: PowerServerResponseDto })
  async start(
    @Param('serverId') serverId: string,
    @GetCurrentUser('sub') userId: string,
  ): Promise<PowerServerResponseDto> {
    return this.serverPower.handleStartServer(serverId, userId);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.SERVER_POWER)
  @Patch(':serverId/stop')
  @ApiOkResponse({ type: PowerServerResponseDto })
  async stop(
    @Param('serverId') serverId: string,
    @GetCurrentUser('sub') userId: string,
  ): Promise<PowerServerResponseDto> {
    return this.serverPower.handleStopServer(serverId, userId);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.SERVER_POWER)
  @Patch(':serverId/reboot')
  @ApiOkResponse({ type: PowerServerResponseDto })
  async reboot(
    @Param('serverId') serverId: string,
    @GetCurrentUser('sub') userId: string,
  ): Promise<PowerServerResponseDto> {
    return this.serverPower.handleRebootServer(serverId, userId);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.SERVER_DISK_MANAGE)
  @Patch('disk/:id')
  @ApiOkResponse({ description: 'Changed correctly' })
  async patchDisk(@Param('id') id: string, @Body() dto: PatchDiskDto) {
    return this.serverService.handlePatchDisk(id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.SERVER_CATEGORY_MANAGE)
  @Post(':serverId/category')
  @ApiOkResponse({ description: 'Changed correctly' })
  async createCategory(
    @Param('serverId') serverId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.serverService.handleCreateCategory(serverId, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.SERVER_CATEGORY_MANAGE)
  @Patch('category/:id')
  @ApiOkResponse({ description: 'Changed correctly' })
  async patchCategory(@Param('id') id: string, @Body() dto: PatchCategoryDto) {
    return this.serverService.handlePatchCategory(id, dto);
  }

  @Public()
  @MessagePattern('server.register')
  async registerServer(dto: RegisterServerDto) {
    return this.serverService.handleRegisterServer(dto);
  }

  @Public()
  @MessagePattern('server.raport-usage')
  async raportServerUsage(dto: UpdateServerPropertiesDto) {
    return this.serverService.updateServerProperties(dto);
  }

  @Public()
  @MessagePattern('server.heartbeat')
  async raportHeartbeat(dto: HeartbeatDto) {
    return this.serverPower.handleHeartbeat(dto);
  }
}
