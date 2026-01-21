import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { PrismaService } from '../prisma/prisma.service';

import { CreateServerTransferDto } from './dto/create-server-transfer.dto';
import { PatchServerTransferDto } from './dto/patch-server-transfer.dto';

import { ServerTransferResponse } from './responses/server-transfer.response';
import { SetServerTransferEvent } from './events';
import { ServerTransferListResponse } from './responses';
import { response } from 'express';
import { PatchServerTransferProgressDto } from './dto';

@Injectable()
export class ServerTransferService {
  constructor(
    @Inject('MULTIVERSE_SERVICE')
    private readonly multiVerseClient: ClientProxy,
    private readonly prisma: PrismaService,
  ) {}

  async listByCategory(
    categoryId: string,
  ): Promise<ServerTransferListResponse> {
    const transfers = await this.prisma.serverTransfer.findMany({
      where: { serverCategoryId: categoryId },
      orderBy: { name: 'asc' },
    });

    return {
      total: transfers.length,
      transfers: transfers,
    };
  }

  async create(
    categoryId: string,
    dto: CreateServerTransferDto,
  ): Promise<ServerTransferResponse> {
    const category = await this.prisma.serverCategory.findUnique({
      where: { id: categoryId },
      include: { server: true },
    });

    if (!category) {
      throw new NotFoundException('ServerCategory not found');
    }

    const created = await this.prisma.serverTransfer.create({
      data: {
        serverCategoryId: categoryId,

        name: dto.name,
        description: dto.description,

        originPath: dto.originPath,
        targetPath: dto.targetPath,

        agentLogPath: dto.agentLogPath,

        enableMoveBackup: dto.enableMoveBackup,
        moveBackupPath: dto.moveBackupPath,

        mode: dto.mode,

        bwLimitKbps: dto.bwLimitKbps,
        secondsStart: dto.secondsStart,
        secondsStop: dto.secondsStop,

        isEnabled: dto.isEnabled,
      },
      include: { serverCategory: { include: { server: true } } },
    });

    this.emitTransferSet(
      created.serverCategory.server.name,
      created.serverCategory.value,
      created,
    );

    return created;
  }

  async patch(
    transferId: string,
    dto: PatchServerTransferDto,
  ): Promise<ServerTransferResponse> {
    const updated = await this.prisma.serverTransfer.update({
      where: { id: transferId },
      data: {
        name: dto.name,
        description: dto.description,

        originPath: dto.originPath,
        targetPath: dto.targetPath,
        agentLogPath: dto.agentLogPath,

        enableMoveBackup: dto.enableMoveBackup,
        moveBackupPath: dto.moveBackupPath,

        mode: dto.mode,

        bwLimitKbps: dto.bwLimitKbps,
        secondsStart: dto.secondsStart,
        secondsStop: dto.secondsStop,

        isEnabled: dto.isEnabled,
      },
      include: { serverCategory: { include: { server: true } } },
    });

    this.emitTransferSet(
      updated.serverCategory.server.name,
      updated.serverCategory.value,
      updated,
    );

    return updated;
  }

  async listForAgent(serverName: string): Promise<ServerTransferResponse[]> {
    const server = await this.prisma.server.findUnique({
      where: { name: serverName },
    });

    if (!server) throw new NotFoundException('Server not found');

    const transfers = await this.prisma.serverTransfer.findMany({
      where: {
        serverCategory: { serverId: server.id },
        isEnabled: true,
      },
      include: { serverCategory: true },
      orderBy: [{ serverCategoryId: 'asc' }, { name: 'asc' }],
    });

    return transfers;
  }

  async patchProgressFromAgent(
    dto: Partial<PatchServerTransferProgressDto>,
  ): Promise<void> {
    const category = await this.prisma.serverCategory.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) throw new NotFoundException('Category not found');

    const transfer = await this.prisma.serverTransfer.findUnique({
      where: {
        serverCategoryId_name: {
          serverCategoryId: category.id,
          name: dto.transferName,
        },
      },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    await this.prisma.serverTransfer.update({
      where: { id: transfer.id },
      data: {
        status: dto.status || transfer.status,
        queuedFiles: dto.queuedFiles || transfer.queuedFiles,
        queuedBytes: dto.queuedBytes || transfer.queuedBytes,
        sentFiles: dto.sentFiles || transfer.sentFiles,
        sentBytes: dto.sentBytes || transfer.sentBytes,
        currentProcessId: dto.currentProcessId || transfer.currentProcessId,
        lastError: dto.lastError || transfer.lastError,
        lastRunAt: dto.lastRunAt || transfer.lastRunAt,
        lastSuccessAt: dto.lastSuccessAt || transfer.lastSuccessAt,
      },
    });
  }

  private emitTransferSet(
    serverName: string,
    categoryValue: string,
    transfer: ServerTransferResponse,
  ) {
    this.multiVerseClient.emit(
      'server.transfer.set',
      new SetServerTransferEvent(
        serverName,
        categoryValue,
        transfer.name,
        transfer,
      ),
    );
  }
}
