import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  GetServerCommandsDto,
  RegisterServerCommandsDto,
  ServerCommandDto,
} from './dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServerCommandsService {
  constructor(private prisma: PrismaService) {}

  async handleGet(dto: GetServerCommandsDto) {
    const commandsInCategories = await this.prisma.server.findMany({
      where: {
        id: dto.serverId,
      },
      select: {
        categories: {
          where: { id: dto.categoryId },
          select: { commands: true, name: true, value: true },
        },
      },
    });
    if (!commandsInCategories) throw new ForbiddenException();
    return commandsInCategories;
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
