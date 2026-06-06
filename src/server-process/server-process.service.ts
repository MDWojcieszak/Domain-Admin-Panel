import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ProcessStatusDto,
  RegisterProcessDto,
  RegisterProcessLogDto,
} from './dto';
import {
  CommandMatchType,
  CommandRuntimeStatus,
  CommandStatus,
  ServerProcessStatus,
} from '@prisma/client';
import { PaginationDto } from '../common/dto';
import { WebsocketGateway } from '../websocket/websocket.gateway';

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
};

type RuntimeStatusUpdate = {
  runtimeStatus?: CommandRuntimeStatus;
  runningProgress?: number | null;
  status?: CommandStatus;
};

const TERMINAL_STATUSES: ServerProcessStatus[] = [
  ServerProcessStatus.CLOSED,
  ServerProcessStatus.ENDED,
  ServerProcessStatus.FAILED,
];

// Runtime statuses that mean "this command settled" — when a command reaches one,
// sibling commands of the same category (e.g. start vs stop) are reset to IDLE.
const SETTLING_STATUSES: CommandRuntimeStatus[] = [
  CommandRuntimeStatus.RUNNING,
  CommandRuntimeStatus.STOPPED,
];

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
      select: {
        id: true,
        name: true,
        status: true,
        progress: true,
        startedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        startedAt: true,
        stoppedAt: true,
      },
      orderBy: { startedAt: 'desc' },
    });
    return { processes, total, params: dto };
  }

  async handleGetOne(processId: string) {
    const process = await this.prisma.process.findUnique({
      where: { id: processId },
      select: {
        id: true,
        name: true,
        status: true,
        progress: true,
        startedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        startedAt: true,
        stoppedAt: true,
      },
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

      this.websocketGateway.sendToAll('process.created', {
        processId: process.id,
        name: process.name,
        status: process.status,
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

      const process = await this.prisma.process.update({
        where: { id: dto.processId },
        data: {
          status: dto.status,
          ...(isTerminal ? { stoppedAt: new Date() } : {}),
          ...(reachedSuccess ? { progress: 100 } : {}),
        },
        select: { id: true, status: true, progress: true, commandId: true },
      });

      this.websocketGateway.sendToAll('process.status', {
        processId: process.id,
        status: process.status,
        progress: process.progress,
      });

      // A failed process maps to a command ERROR so the panel reflects it live.
      if (dto.status === ServerProcessStatus.FAILED && process.commandId) {
        await this.applyCommandRuntimeStatus(process.commandId, {
          runtimeStatus: CommandRuntimeStatus.ERROR,
        });
      }

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

      this.websocketGateway.sendToAll('process.log', {
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
   * Updates a command's runtime state (status / progress) and broadcasts it live.
   * Shared by marker-driven progress (here) and agent-driven updates
   * (ServerCommandsService.handleUpdateCommand). When a command settles into
   * RUNNING/STOPPED, sibling commands of the same category are reset to IDLE so
   * e.g. "stop" becomes ready again once "start" is running.
   */
  async applyCommandRuntimeStatus(
    commandId: string,
    update: RuntimeStatusUpdate,
  ): Promise<void> {
    const data: {
      runtimeStatus?: CommandRuntimeStatus;
      runningProgress?: number | null;
      status?: CommandStatus;
    } = {};

    if (update.runtimeStatus !== undefined) {
      data.runtimeStatus = update.runtimeStatus;
    }
    if (update.runningProgress !== undefined) {
      data.runningProgress = update.runningProgress;
    }
    if (update.status !== undefined) {
      data.status = update.status;
    }

    if (Object.keys(data).length === 0) return;

    const command = await this.prisma.serverCommand.update({
      where: { id: commandId },
      data,
      select: {
        id: true,
        serverCategoryId: true,
        status: true,
        runtimeStatus: true,
        runningProgress: true,
      },
    });

    this.websocketGateway.sendToAll('server-command.update', {
      commandId: command.id,
      status: command.status,
      runtimeStatus: command.runtimeStatus,
      runningProgress: command.runningProgress,
    });

    if (
      update.runtimeStatus !== undefined &&
      SETTLING_STATUSES.includes(update.runtimeStatus)
    ) {
      await this.resetSiblingCommands(command.serverCategoryId, command.id);
    }
  }

  private async resetSiblingCommands(
    categoryId: string,
    exceptCommandId: string,
  ): Promise<void> {
    const siblings = await this.prisma.serverCommand.findMany({
      where: {
        serverCategoryId: categoryId,
        id: { not: exceptCommandId },
        runtimeStatus: { not: CommandRuntimeStatus.IDLE },
      },
      select: { id: true },
    });

    if (siblings.length === 0) return;

    const ids = siblings.map((sibling) => sibling.id);

    await this.prisma.serverCommand.updateMany({
      where: { id: { in: ids } },
      data: { runtimeStatus: CommandRuntimeStatus.IDLE, runningProgress: null },
    });

    for (const id of ids) {
      this.invalidateProgressCache(id);
      this.websocketGateway.sendToAll('server-command.update', {
        commandId: id,
        runtimeStatus: CommandRuntimeStatus.IDLE,
        runningProgress: null,
      });
    }
  }

  private async applyMarkersToLine(
    processId: string,
    message: string,
  ): Promise<void> {
    const context = await this.ensureProgressContext(processId);
    if (!context || context.markers.length === 0) return;

    let nextProgress = context.currentProgress;
    let progressLabel: string | null = null;
    let nextRuntimeStatus: CommandRuntimeStatus | null = null;

    for (const marker of context.markers) {
      if (!this.lineMatchesMarker(message, marker)) continue;

      if (marker.progress != null && marker.progress > nextProgress) {
        nextProgress = marker.progress;
        progressLabel = marker.label;
      }
      if (marker.runtimeStatus) {
        nextRuntimeStatus = marker.runtimeStatus;
      }
    }

    const progressChanged = nextProgress > context.currentProgress;
    if (!progressChanged && !nextRuntimeStatus) return;

    if (progressChanged) {
      context.currentProgress = nextProgress;

      await this.prisma.process.update({
        where: { id: processId },
        data: { progress: nextProgress },
      });

      this.websocketGateway.sendToAll('process.progress', {
        processId,
        progress: nextProgress,
        label: progressLabel,
      });
    }

    if (context.commandId) {
      await this.applyCommandRuntimeStatus(context.commandId, {
        runtimeStatus: nextRuntimeStatus ?? undefined,
        runningProgress: progressChanged ? nextProgress : undefined,
      });
    }
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
