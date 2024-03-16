import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  GetServerSettingsDto,
  RegisterServerSettingsDto,
  ServerSettingsDto,
} from './dto';
import { ClientProxy } from '@nestjs/microservices';
import { SetSettingEvent } from './events';

@Injectable()
export class ServerSettingsService {
  constructor(
    private prisma: PrismaService,
    @Inject('MULTIVERSE_SERVICE') private multiVerseClient: ClientProxy,
  ) {}

  async handleGet(dto: GetServerSettingsDto) {
    const settingsInCategories = await this.prisma.server.findMany({
      where: {
        id: dto.serverId,
      },
      select: {
        categories: {
          where: { id: dto.categoryId },
          select: { settings: true, name: true, value: true },
        },
      },
    });
    if (!settingsInCategories) throw new ForbiddenException();
    return settingsInCategories;
  }

  async handleRegisterSettings(dto: RegisterServerSettingsDto) {
    try {
      const server = await this.prisma.server.findUnique({
        where: { name: dto.serverName },
      });
      if (!server) throw new ForbiddenException();
      const categories = this.groupSettingsByCategory(dto.settings);
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
          const settingsInCategory = categories[category];
          await Promise.all(
            settingsInCategory.map(async (setting) => {
              const existingSetting =
                await this.prisma.serverSettings.findFirst({
                  where: {
                    serverCategoryId: existingCategory.id,
                    serverName: setting.settingName,
                  },
                });
              if (!existingSetting) {
                await this.prisma.serverSettings.create({
                  data: {
                    serverName: setting.settingName,
                    type: setting.settingType,
                    value: setting.settingValue,
                    serverCategory: { connect: { id: existingCategory.id } },
                  },
                });
              } else {
                if (existingSetting.value !== setting.settingValue)
                  this.multiVerseClient.emit(
                    'set_setting',
                    new SetSettingEvent(
                      server.name,
                      existingSetting.serverName,
                      existingSetting.value,
                      category,
                    ),
                  );
              }
            }),
          );
        }
      }
      return true;
    } catch (error) {
      throw new Error(`Failed to register server settings: ${error.message}`);
    }
  }

  groupSettingsByCategory(
    commands: ServerSettingsDto[],
  ): Record<string, ServerSettingsDto[]> {
    return commands.reduce(
      (
        acc: Record<string, ServerSettingsDto[]>,
        command: ServerSettingsDto,
      ) => {
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
