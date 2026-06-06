import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommandMatchType, CommandRuntimeStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { ServerProcessService } from '../server-process/server-process.service';
import {
  CreateCommandProgressMarkerDto,
  UpdateCommandProgressMarkerDto,
} from './dto';

@Injectable()
export class CommandProgressMarkerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serverProcessService: ServerProcessService,
  ) {}

  async list(commandId: string) {
    await this.getCommandOrThrow(commandId);

    const markers = await this.prisma.commandProgressMarker.findMany({
      where: { commandId },
      orderBy: [{ order: 'asc' }, { progress: 'asc' }],
    });

    return { markers, total: markers.length };
  }

  async create(commandId: string, dto: CreateCommandProgressMarkerDto) {
    await this.getCommandOrThrow(commandId);

    const matchType = dto.matchType ?? CommandMatchType.CONTAINS;
    this.assertValidPattern(matchType, dto.pattern);
    this.assertHasEffect(dto.progress, dto.runtimeStatus);

    const marker = await this.prisma.commandProgressMarker.create({
      data: {
        commandId,
        label: dto.label,
        pattern: dto.pattern,
        matchType,
        progress: dto.progress,
        runtimeStatus: dto.runtimeStatus,
        level: dto.level,
        order: dto.order ?? 0,
      },
    });

    this.serverProcessService.invalidateProgressCache(commandId);

    return marker;
  }

  async update(markerId: string, dto: UpdateCommandProgressMarkerDto) {
    const existing = await this.getMarkerOrThrow(markerId);

    const matchType = dto.matchType ?? existing.matchType;
    const pattern = dto.pattern ?? existing.pattern;
    this.assertValidPattern(matchType, pattern);

    const nextProgress =
      dto.progress !== undefined ? dto.progress : existing.progress;
    const nextRuntimeStatus =
      dto.runtimeStatus !== undefined
        ? dto.runtimeStatus
        : existing.runtimeStatus;
    this.assertHasEffect(nextProgress, nextRuntimeStatus);

    const marker = await this.prisma.commandProgressMarker.update({
      where: { id: markerId },
      data: {
        label: dto.label,
        pattern: dto.pattern,
        matchType: dto.matchType,
        progress: dto.progress,
        runtimeStatus: dto.runtimeStatus,
        level: dto.level,
        order: dto.order,
      },
    });

    this.serverProcessService.invalidateProgressCache(existing.commandId);

    return marker;
  }

  async remove(markerId: string) {
    const existing = await this.getMarkerOrThrow(markerId);

    const marker = await this.prisma.commandProgressMarker.delete({
      where: { id: markerId },
    });

    this.serverProcessService.invalidateProgressCache(existing.commandId);

    return marker;
  }

  private async getCommandOrThrow(commandId: string) {
    const command = await this.prisma.serverCommand.findUnique({
      where: { id: commandId },
      select: { id: true },
    });

    if (!command) throw new NotFoundException('Command not found');

    return command;
  }

  private async getMarkerOrThrow(markerId: string) {
    const marker = await this.prisma.commandProgressMarker.findUnique({
      where: { id: markerId },
    });

    if (!marker) throw new NotFoundException('Progress marker not found');

    return marker;
  }

  private assertValidPattern(
    matchType: CommandMatchType,
    pattern: string,
  ): void {
    if (matchType !== CommandMatchType.REGEX) return;

    try {
      new RegExp(pattern);
    } catch {
      throw new BadRequestException(`Invalid regular expression: ${pattern}`);
    }
  }

  private assertHasEffect(
    progress?: number | null,
    runtimeStatus?: CommandRuntimeStatus | null,
  ): void {
    if (
      (progress === undefined || progress === null) &&
      (runtimeStatus === undefined || runtimeStatus === null)
    ) {
      throw new BadRequestException(
        'Marker must define at least progress or runtimeStatus',
      );
    }
  }
}
