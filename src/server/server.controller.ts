import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ServerService } from './server.service';
import { GetCurrentUser, Public, Roles } from '../common/decorators';
import { MessagePattern } from '@nestjs/microservices';
import { HeartbeatDto, PatchDiskDto, RegisterServerDto } from './dto';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  ServerDetailsResponseDto,
  ServerListResponseDto,
  ServerResponseDto,
  StartServerResponseDto,
  StopServerResponseDto,
} from './responses';
import { PaginationDto } from '../common/dto';
import { UpdateServerPropertiesDto } from './dto/updateServerProperties.dto';
import { PatchCategorykDto } from './dto/patch-category.dto';
import { ServerPowerService } from './server-power.service';

@ApiTags('Server')
@Controller('server')
export class ServerController {
  constructor(
    private serverService: ServerService,
    private serverPower: ServerPowerService,
  ) {}

  @ApiBearerAuth()
  @Roles('ADMIN', 'OWNER')
  @Get('all')
  @ApiOkResponse({ type: ServerListResponseDto })
  async getAll(@Query() dto: PaginationDto): Promise<ServerListResponseDto> {
    return this.serverService.handleGetAll(dto);
  }

  @ApiBearerAuth()
  @Roles('ADMIN', 'OWNER')
  @Get(':serverId')
  @ApiOkResponse({ type: ServerResponseDto })
  async get(@Param('serverId') serverId: string): Promise<ServerResponseDto> {
    return this.serverService.handleGet(serverId);
  }

  @ApiBearerAuth()
  @Roles('ADMIN', 'OWNER')
  @Get('details/:serverId')
  @ApiOkResponse({ type: ServerDetailsResponseDto })
  async getDetails(
    @Param('serverId') serverId: string,
  ): Promise<ServerDetailsResponseDto> {
    return this.serverService.handleGetDetails(serverId);
  }

  @ApiBearerAuth()
  @Roles('ADMIN', 'OWNER')
  @Patch(':serverId/start')
  @ApiOkResponse({ type: ServerDetailsResponseDto })
  async start(
    @Param('serverId') serverId: string,
    @GetCurrentUser('sub') userId: string,
  ): Promise<StartServerResponseDto> {
    return this.serverPower.handleStartServer(serverId, userId);
  }

  @ApiBearerAuth()
  @Roles('ADMIN', 'OWNER')
  @Patch(':serverId/stop')
  @ApiOkResponse({ type: StopServerResponseDto })
  async stop(
    @Param('serverId') serverId: string,
    @GetCurrentUser('sub') userId: string,
  ): Promise<StopServerResponseDto> {
    return this.serverPower.handleStopServer(serverId, userId);
  }

  @ApiBearerAuth()
  @Roles('OWNER')
  @Patch('disk/:id')
  @ApiOkResponse({ description: 'Changed correctly' })
  async patchDisk(@Param('id') id: string, @Body() dto: PatchDiskDto) {
    return this.serverService.handlePatchDisk(id, dto);
  }

  @ApiBearerAuth()
  @Roles('OWNER')
  @Patch('catgory/:id')
  @ApiOkResponse({ description: 'Changed correctly' })
  async patchCategory(@Param('id') id: string, @Body() dto: PatchCategorykDto) {
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
