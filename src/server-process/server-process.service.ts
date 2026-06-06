import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ProcessStatusDto,
  RegisterProcessDto,
  RegisterProcessLogDto,
} from './dto';
import {
  CommandMatchType,
  CommandRuntimeStatus,
  ServerProcessStatus,
} from '@prisma/client';
import { PaginationDto } from '../common/dto';
import { WebsocketGateway, WsRoom } from '../websocket/websocket.gateway';

type CompiledMarker = {
  id: string;
  label: string | null;
  matchType: CommandMatchType;
  pattern: string;
  progress: number | null;
  runtimeStatus: CommandRuntimeStatus | null;
  regex?: RegExp;
};

type ProcessProgressContext = {
  commandId: string | null;
  markers: CompiledMarker[];
  currentProgress: number;
  currentRuntimeStatus: CommandRuntimeStatus;
};

const TERMINAL_STATUSES: ServerProcessStatus[] = [
  ServerProcessStatus.CLOSED,
  ServerProcessStatus.ENDED,
  ServerProcessStatus.FAILED,
];

const PROCESS_SELECT = {
  id: true,
  name: true,
  status: true,
  runtimeStatus: true,
  progress: true,
  startedBy: {
    select: { id: true, email: true, firstName: true, lastName: true },
  },
  category: { select: { id: true, name: true } },
  startedAt: true,
  stoppedAt: true,
} as const;

@Injectable()
export class ServerProcessService {
  private readonly progressContexts = new Map<string, ProcessProgressContext>();

  constructor(
    private prisma: PrismaService,
    private readonly websocketGateway: WebsocketGateway,
  ) {}

  async handleGetAll(dto: PaginationDto) {
    const total = await this.prisma.process.count();
    const processes = await this.prisma.process.findMany({
      take: dto.take,
      skip: dto.skip,
      select: PROCESS_SELECT,
      orderBy: { startedAt: 'desc' },
    });
    return { processes, total, params: dto };
  }

  async handleGetOne(processId: string) {
    const process = await this.prisma.process.findUnique({
      where: { id: processId },
      select: PROCESS_SELECT,
    });
    return process;
  }

  async handleGetAllLogs(processId: string, dto: PaginationDto) {
    const total = await this.prisma.processLog.count({
      where: { processId },
    });
    const logs = await this.prisma.processLog.findMany({
      where: { processId },
      select: {
        id: true,
        message: true,
        level: true,
        timestamp: true,
      },
      take: dto.take,
      skip: dto.skip,
      orderBy: { timestamp: 'desc' },
    });
    return { logs, total, params: dto };
  }

  async handleDelete(processId: string) {
    const process = await this.prisma.process.findUnique({
      where: { id: processId },
      select: { id: true },
    });

    if (!process) throw new NotFoundException('Process not found');

    // ProcessLog cascades on delete; ServerTransfer.currentProcessId is set null.
    await this.prisma.process.delete({ where: { id: processId } });

    this.progressContexts.delete(processId);

    this.websocketGateway.emitToRoom(WsRoom.PROCESSES, 'process.deleted', {
      processId,
    });

    return { success: true };
  }

  async handleRegister(dto: RegisterProcessDto) {
    try {
      const commandId = await this.resolveCommandId(
        dto.categoryId,
        dto.commandValue,
      );

      const process = await this.prisma.process.create({
        data: {
          name: dto.name,
          status: dto.status || ServerProcessStatus.UNKNOWN,
          progress: 0,
          startedBy: { connect: { id: dto.userId } },
          category: { connect: { id: dto.categoryId } },
          ...(commandId ? { command: { connect: { id: commandId } } } : {}),
        },
      });

      this.websocketGateway.emitToRoom(WsRoom.PROCESSES, 'process.created', {
        processId: process.id,
        name: process.name,
        status: process.status,
        runtimeStatus: process.runtimeStatus,
        progress: process.progress,
        categoryId: dto.categoryId,
        commandId,
      });

      return process.id;
    } catch (e) {
      Logger.log(e);
      return false;
    }
  }

  async handleChangeStatus(dto: ProcessStatusDto) {
    try {
      const isTerminal = TERMINAL_STATUSES.includes(dto.status);
      const reachedSuccess =
        dto.status === ServerProcessStatus.ENDED ||
        dto.status === ServerProcessStatus.CLOSED;
      const failed = dto.status === ServerProcessStatus.FAILED;

      const process = await this.prisma.process.update({
        where: { id: dto.processId },
        data: {
          status: dto.status,
          ...(isTerminal ? { stoppedAt: new Date() } : {}),
          ...(reachedSuccess ? { progress: 100 } : {}),
          ...(failed ? { runtimeStatus: CommandRuntimeStatus.ERROR } : {}),
        },
        select: {
          id: true,
          status: true,
          runtimeStatus: true,
          progress: true,
        },
      });

      this.websocketGateway.emitToRoom(WsRoom.PROCESSES, 'process.status', {
        processId: process.id,
        status: process.status,
        runtimeStatus: process.runtimeStatus,
        progress: process.progress,
      });

      if (isTerminal) {
        this.progressContexts.delete(dto.processId);
      }
    } catch (e) {
      Logger.log(e);
    }
  }

  async handleRegisterLog(dto: RegisterProcessLogDto) {
    try {
      const log = await this.prisma.processLog.create({
        data: {
          message: dto.message,
          process: { connect: { id: dto.processId } },
          level: dto.level,
        },
        select: { id: true, message: true, level: true, timestamp: true },
      });

      this.websocketGateway.emitToRoom(WsRoom.PROCESSES, 'process.log', {
        processId: dto.processId,
        id: log.id,
        message: log.message,
        level: log.level,
        timestamp: log.timestamp,
      });

      await this.applyMarkersToLine(dto.processId, dto.message);
    } catch (e) {
      Logger.log(e);
    }
  }

  /** Clears cached marker contexts for a command (called when its markers change). */
  invalidateProgressCache(commandId?: string): void {
    if (!commandId) {
      this.progressContexts.clear();
      return;
    }

    for (const [processId, context] of this.progressContexts) {
      if (context.commandId === commandId) {
        this.progressContexts.delete(processId);
      }
    }
  }

  /**
   * Matches a console line against the command's progress markers and applies the
   * result to the PROCESS: progress is monotonic, runtimeStatus is set when a
   * marker carries one. Emits a single live `process.progress` update.
   */
  private async applyMarkersToLine(
    processId: string,
    message: string,
  ): Promise<void> {
    const context = await this.ensureProgressContext(processId);
    if (!context || context.markers.length === 0) return;

    let nextProgress = context.currentProgress;
    let progressLabel: string | null = null;
    let nextRuntimeStatus = context.currentRuntimeStatus;
    let runtimeStatusMatched = false;

    for (const marker of context.markers) {
      if (!this.lineMatchesMarker(message, marker)) continue;

      if (marker.progress != null && marker.progress > nextProgress) {
        nextProgress = marker.progress;
        progressLabel = marker.label;
      }
      if (marker.runtimeStatus) {
        nextRuntimeStatus = marker.runtimeStatus;
        runtimeStatusMatched = true;
      }
    }

    const progressChanged = nextProgress > context.currentProgress;
    const runtimeStatusChanged =
      runtimeStatusMatched && nextRuntimeStatus !== context.currentRuntimeStatus;

    if (!progressChanged && !runtimeStatusChanged) return;

    const data: { progress?: number; runtimeStatus?: CommandRuntimeStatus } = {};
    if (progressChanged) {
      data.progress = nextProgress;
      context.currentProgress = nextProgress;
    }
    if (runtimeStatusChanged) {
      data.runtimeStatus = nextRuntimeStatus;
      context.currentRuntimeStatus = nextRuntimeStatus;
    }

    await this.prisma.process.update({
      where: { id: processId },
      data,
    });

    this.websocketGateway.emitToRoom(WsRoom.PROCESSES, 'process.progress', {
      processId,
      progress: context.currentProgress,
      runtimeStatus: context.currentRuntimeStatus,
      label: progressLabel,
    });
  }

  private async ensureProgressContext(
    processId: string,
  ): Promise<ProcessProgressContext | null> {
    const cached = this.progressContexts.get(processId);
    if (cached) return cached;

    const process = await this.prisma.process.findUnique({
      where: { id: processId },
      select: {
        progress: true,
        runtimeStatus: true,
        commandId: true,
        command: {
          select: {
            progressMarkers: {
              orderBy: { progress: 'asc' },
              select: {
                id: true,
                label: true,
                pattern: true,
                matchType: true,
                progress: true,
                runtimeStatus: true,
              },
            },
          },
        },
      },
    });

    if (!process) return null;

    const markers: CompiledMarker[] = (
      process.command?.progressMarkers ?? []
    ).map((marker) => ({
      id: marker.id,
      label: marker.label,
      matchType: marker.matchType,
      pattern: marker.pattern,
      progress: marker.progress,
      runtimeStatus: marker.runtimeStatus,
      regex:
        marker.matchType === CommandMatchType.REGEX
          ? this.safeCompileRegex(marker.pattern)
          : undefined,
    }));

    const context: ProcessProgressContext = {
      commandId: process.commandId ?? null,
      markers,
      currentProgress: process.progress ?? 0,
      currentRuntimeStatus: process.runtimeStatus,
    };

    this.progressContexts.set(processId, context);
    return context;
  }

  private lineMatchesMarker(message: string, marker: CompiledMarker): boolean {
    switch (marker.matchType) {
      case CommandMatchType.CONTAINS:
        return message.includes(marker.pattern);
      case CommandMatchType.STARTS_WITH:
        return message.trimStart().startsWith(marker.pattern);
      case CommandMatchType.REGEX:
        return marker.regex ? marker.regex.test(message) : false;
      default:
        return false;
    }
  }

  private safeCompileRegex(pattern: string): RegExp | undefined {
    try {
      return new RegExp(pattern);
    } catch (e) {
      Logger.warn(`Invalid progress marker regex: ${pattern}`);
      return undefined;
    }
  }

  private async resolveCommandId(
    categoryId: string,
    commandValue?: string,
  ): Promise<string | null> {
    if (!commandValue) return null;

    const command = await this.prisma.serverCommand.findFirst({
      where: { serverCategoryId: categoryId, value: commandValue },
      select: { id: true },
    });

    if (!command) {
      Logger.warn(
        `Process registered for unknown command "${commandValue}" in category ${categoryId}`,
      );
      return null;
    }

    return command.id;
  }
}
