import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import {
  GetServerCommandsDto,
  PatchServerCommandDto,
  RegisterServerCommandsDto,
  ServerCommandDto,
} from './dto';
import { PrismaService } from '../prisma/prisma.service';
import { ClientProxy } from '@nestjs/microservices';
import { SendCommandEvent } from './events';
import { firstValueFrom } from 'rxjs';
import { CommandContext } from '../common/types';

@Injectable()
export class ServerCommandsService {
  constructor(
    private prisma: PrismaService,
    @Inject('MULTIVERSE_SERVICE') private multiVerseClient: ClientProxy,
  ) {}

  async handleGet(dto: GetServerCommandsDto) {
    const commandsInCategories = await this.prisma.serverCategory.findUnique({
      where: {
        id: dto.categoryId,
      },
      select: { commands: true, name: true, value: true },
    });
    if (!commandsInCategories) throw new ForbiddenException();
    return commandsInCategories.commands;
  }

  async handlePatch(id: string, dto: PatchServerCommandDto) {
    const command = await this.get(id);
    const updatedCommand = await this.prisma.serverCommand.update({
      where: { id: command.id },
      data: { name: dto.name },
    });
    return updatedCommand;
  }

  async handleSend(id: string, userId: string) {
    const command = await this.get(id);
    const server = await this.getServer(id);
    const context: CommandContext = {
      categoryId: command.serverCategoryId,
      serverId: server.id,
      userId,
    };
    try {
      switch (command.type) {
        case 'EVENT':
          this.multiVerseClient.emit(
            command.value,
            new SendCommandEvent(context),
          );
          return {
            sent: true,
          };
        case 'MESSAGE':
          const sendRes = await firstValueFrom(
            this.multiVerseClient.send(
              command.value,
              new SendCommandEvent(context),
            ),
          );
          return {
            executed: sendRes,
          };
      }
    } catch (error) {
      Logger.error('COMMAND_FAILED', command.value);
      throw new ForbiddenException('COMMAND_FAILED');
    }
  }

  async handleRegisterCommands(dto: RegisterServerCommandsDto) {
    try {
      const server = await this.prisma.server.findUnique({
        where: { name: dto.serverName },
      });
      if (!server) throw new ForbiddenException();

      const categories = this.groupCommandsByCategory(dto.commands);

      for (const category in categories) {
        if (Object.prototype.hasOwnProperty.call(categories, category)) {
          let existingCategory = await this.prisma.serverCategory.findFirst({
            where: { serverId: server.id, value: category },
          });
          if (!existingCategory) {
            existingCategory = await this.prisma.serverCategory.create({
              data: {
                value: category,
                server: { connect: { id: server.id } },
              },
            });
          }
          const commandsInCategory = categories[category];
          await Promise.all(
            commandsInCategory.map(async (command) => {
              const existingCommand = await this.prisma.serverCommand.findFirst(
                {
                  where: {
                    serverCategoryId: existingCategory.id,
                    value: command.commandName,
                  },
                },
              );
              if (!existingCommand) {
                await this.prisma.serverCommand.create({
                  data: {
                    type: command.commandType,
                    value: command.commandName,
                    serverCategory: { connect: { id: existingCategory.id } },
                  },
                });
              }
            }),
          );
        }
      }
      return true;
    } catch (error) {
      throw new Error(`Failed to register server commands: ${error.message}`);
    }
  }

  async get(id: string) {
    const command = await this.prisma.serverCommand.findUnique({
      where: { id },
    });

    if (!command) throw new ForbiddenException();
    return command;
  }

  async getServer(id: string) {
    const server = await this.prisma.server.findFirst({
      where: { categories: { some: { commands: { some: { id } } } } },
    });
    if (!server) throw new ForbiddenException();
    return server;
  }

  groupCommandsByCategory(
    commands: ServerCommandDto[],
  ): Record<string, ServerCommandDto[]> {
    return commands.reduce(
      (acc: Record<string, ServerCommandDto[]>, command: ServerCommandDto) => {
        const { category } = command;
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(command);
        return acc;
      },
      {},
    );
  }
}
