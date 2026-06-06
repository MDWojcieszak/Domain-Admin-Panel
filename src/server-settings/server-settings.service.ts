import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  GetServerSettingsDto,
  PatchServerSettingDto,
  RegisterServerSettingsDto,
  ServerSettingsDto,
} from './dto';
import { SetSettingEvent } from './events';
import { Prisma, SettingType } from '@prisma/client';
import { ServerOutboundMessagingService } from '../server-outbound/server-outbound-messaging.service';

@Injectable()
export class ServerSettingsService {
  constructor(
    private prisma: PrismaService,
    private readonly outbound: ServerOutboundMessagingService,
  ) {}

  async handleGet(dto: GetServerSettingsDto) {
    const where: Prisma.ServerSettingsWhereInput = {
      serverCategory: {
        serverId: dto.serverId,
        ...(dto.categoryId ? { id: dto.categoryId } : {}),
      },
    };

    const [settings, total] = await Promise.all([
      this.prisma.serverSettings.findMany({
        where,
        select: {
          id: true,
          name: true,
          serverName: true,
          type: true,
          value: true,
          serverCategory: { select: { id: true, name: true } },
        },
        orderBy: [{ serverCategoryId: 'asc' }, { serverName: 'asc' }],
      }),
      this.prisma.serverSettings.count({ where }),
    ]);

    return { settings, total };
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

      this.outbound.emitToServer(
        server.name,
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
                  this.outbound.emitToServer(
                    server.name,
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
