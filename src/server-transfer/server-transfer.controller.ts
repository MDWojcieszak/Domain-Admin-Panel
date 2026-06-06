import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { EventPattern, MessagePattern } from '@nestjs/microservices';

import { ServerTransferService } from './server-transfer.service';
import { CreateServerTransferDto } from './dto/create-server-transfer.dto';
import { PatchServerTransferDto } from './dto/patch-server-transfer.dto';
import { ServerTransferResponse } from './responses/server-transfer.response';
import { Public, ReplyType, RequirePermissions } from '../common/decorators';
import { PERMISSIONS } from '../common/acl/permissions';
import { ServerTransferListResponse } from './responses';
import {
  GetServerTransfersForAgentDto,
  PatchServerTransferProgressDto,
} from './dto';

@Controller('server-transfer')
export class ServerTransferController {
  constructor(private readonly serverTransferService: ServerTransferService) {}

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.TRANSFER_READ)
  @Get('category/:id')
  @ApiOkResponse({
    description: 'List transfers by category',
    type: ServerTransferListResponse,
  })
  async listByCategory(
    @Param('id') categoryId: string,
  ): Promise<ServerTransferListResponse> {
    return this.serverTransferService.listByCategory(categoryId);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.TRANSFER_MANAGE)
  @Post('category/:id')
  @ApiOkResponse({
    description: 'Created transfer',
    type: ServerTransferResponse,
  })
  async create(
    @Param('id') categoryId: string,
    @Body() dto: CreateServerTransferDto,
  ): Promise<ServerTransferResponse> {
    return this.serverTransferService.create(categoryId, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.TRANSFER_MANAGE)
  @Patch(':id')
  @ApiOkResponse({
    description: 'Patched transfer',
    type: ServerTransferResponse,
  })
  async patch(
    @Param('id') id: string,
    @Body() dto: PatchServerTransferDto,
  ): Promise<ServerTransferResponse> {
    return this.serverTransferService.patch(id, dto);
  }

  @Public()
  @MessagePattern('server.transfer.get')
  @ReplyType(ServerTransferResponse, { isArray: true })
  async getTransfersForAgent(
    dto: GetServerTransfersForAgentDto,
  ): Promise<ServerTransferResponse[]> {
    return this.serverTransferService.listForAgent(dto.serverName);
  }

  @Public()
  @EventPattern('server.transfer.progress')
  async patchProgress(dto: PatchServerTransferProgressDto) {
    this.serverTransferService.patchProgressFromAgent(dto);
  }
}
