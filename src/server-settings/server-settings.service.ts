import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  GetServerSettingsDto,
  PatchServerSettingDto,
  RegisterServerSettingsDto,
  ServerSettingsDto,
} from './dto';
import { ClientProxy } from '@nestjs/microservices';
import { SetSettingEvent } from './events';
import { SettingType } from '@prisma/client';

@Injectable()
export class ServerSettingsService {
  constructor(
    private prisma: PrismaService,
    @Inject('MULTIVERSE_SERVICE') private multiVerseClient: ClientProxy,
  ) {}

  async handleGet(dto: GetServerSettingsDto) {
    const count = await this.prisma.serverSettings.count({
      where: {
        serverCategory: {
          serverId: dto.serverId,
          id: dto.categoryId || undefined,
        },
      },
    });
    const settingsInCategories = await this.prisma.serverCategory.findUnique({
      where: {
        id: dto.categoryId || undefined,
        serverId: dto.serverId,
      },
      select: {
        settings: {
          select: {
            id: true,
            serverName: true,
            type: true,
            value: true,
            serverCategory: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!settingsInCategories) throw new ForbiddenException();
    return {
      settings: settingsInCategories.settings,
      total: count,
    };
  }

  async handlePatch(id: string, dto: PatchServerSettingDto) {
    try {
      const server = await this.prisma.server.findFirst({
        where: { categories: { some: { settings: { some: { id } } } } },
      });
      const setting = await this.prisma.serverSettings.findUnique({
        where: { id },
      });
      if (!setting || !server) throw new ForbiddenException();
      if (
        dto.value &&
        setting.type === SettingType.NUMBER &&
        isNaN(Number(dto.value))
      ) {
        throw new ForbiddenException('Value must be a number');
      }
      const updatedSetting = await this.prisma.serverSettings.update({
        where: { id },
        data: { name: dto.name, value: dto.value },
        select: {
          id: true,
          serverName: true,
          type: true,
          value: true,
          serverCategory: { select: { id: true, name: true, value: true } },
        },
      });

      this.multiVerseClient.emit(
        'setting.set',
        new SetSettingEvent(
          server.name,
          updatedSetting.serverName,
          updatedSetting.value,
          updatedSetting.serverCategory.value,
        ),
      );
      return updatedSetting;
    } catch (error) {
      throw new Error(`Failed to update server setting: ${error.message}`);
    }
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
                    'setting.set',
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
