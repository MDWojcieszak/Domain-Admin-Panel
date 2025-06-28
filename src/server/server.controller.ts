import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ServerService } from './server.service';
import { Public, Roles } from '../common/decorators';
import { MessagePattern } from '@nestjs/microservices';
import { PatchDiskDto, RegisterServerDto } from './dto';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  ServerDetailsResponseDto,
  ServerListResponseDto,
  ServerResponseDto,
} from './responses';
import { PaginationDto } from '../common/dto';
import { UpdateServerPropertiesDto } from './dto/updateServerProperties.dto';
import { PatchCategorykDto } from './dto/patch-category.dto';

@ApiTags('Server')
@Controller('server')
export class ServerController {
  constructor(private serverService: ServerService) {}

  @Roles('ADMIN', 'OWNER')
  @Get(':serverId')
  @ApiOkResponse({ type: ServerResponseDto })
  async get(@Param('serverId') serverId: string): Promise<ServerResponseDto> {
    return this.serverService.handleGet(serverId);
  }

  @Roles('ADMIN', 'OWNER')
  @Get('all')
  @ApiOkResponse({ type: ServerListResponseDto })
  async getAll(@Query() dto: PaginationDto): Promise<ServerListResponseDto> {
    return this.serverService.handleGetAll(dto);
  }

  @Roles('ADMIN', 'OWNER')
  @Get('details/:serverId')
  @ApiOkResponse({ type: ServerDetailsResponseDto })
  async getDetails(
    @Param('serverId') serverId: string,
  ): Promise<ServerDetailsResponseDto> {
    return this.serverService.handleGetDetails(serverId);
  }

  @Roles('OWNER')
  @Patch('disk/:id')
  @ApiOkResponse({ description: 'Changed correctly' })
  async patchDisk(@Param('id') id: string, @Body() dto: PatchDiskDto) {
    return this.serverService.handlePatchDisk(id, dto);
  }

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
}
