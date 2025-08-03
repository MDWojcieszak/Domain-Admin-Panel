import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AiContextResponseDto,
  AiHistoryListResponseDto,
} from '../common/responses';
import { PrismaService } from '../prisma/prisma.service';
import { PlaceAiDetailResponseDto, PlaceAiListResponseDto } from './responses';
import { PlaceAiCreateDto, PlaceAiUpdateDto } from './dto';
import { AiContextDto } from '../common/dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class PlaceAiService {
  constructor(private readonly prisma: PrismaService) {}

  async listPlacesForAI(userId: string): Promise<PlaceAiListResponseDto> {
    const places = await this.prisma.place.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      include: {
        aiContext: true,
        location: true,
      },
    });

    return {
      places,
      total: places.length,
    };
  }

  async getPlaceForAI(
    userId: string,
    id: string,
  ): Promise<PlaceAiDetailResponseDto> {
    return await this.getPlace(userId, id);
  }

  async createPlace(
    userId: string,
    dto: PlaceAiCreateDto,
  ): Promise<PlaceAiDetailResponseDto> {
    let locationId: string | undefined = undefined;

    if (dto.location) {
      const createdLocation = await this.prisma.location.create({
        data: {
          ...dto.location,
          createdBy: { connect: { id: userId } },
        },
      });
      locationId = createdLocation.id;
    }

    const { location, ...placeData } = dto;

    const place = await this.prisma.place.create({
      data: {
        ...placeData,
        ownerId: userId,
        ...(locationId && { locationId }),
      },
      include: { aiContext: true, location: true },
    });

    if (place.aiContextId) {
      await this.logAiHistory(place.aiContextId, {
        action: 'create_place',
        meta: { placeId: place.id, data: dto },
      });
    }

    return place;
  }

  async updatePlace(
    userId: string,
    id: string,
    dto: PlaceAiUpdateDto,
  ): Promise<PlaceAiDetailResponseDto> {
    const place = await this.getPlace(userId, id);

    let locationId = place.locationId;

    if (dto.location) {
      if (locationId) {
        const updatedLocation = await this.prisma.location.update({
          where: { id: locationId },
          data: dto.location,
        });
        locationId = updatedLocation.id;
      } else {
        const createdLocation = await this.prisma.location.create({
          data: {
            ...dto.location,
            createdBy: { connect: { id: userId } },
          },
        });
        locationId = createdLocation.id;
      }
    }

    const { location, ...placeData } = dto;

    const updated = await this.prisma.place.update({
      where: { id: place.id },
      data: {
        ...placeData,
        locationId,
      },
      include: { aiContext: true, location: true },
    });

    if (updated.aiContextId) {
      await this.logAiHistory(updated.aiContextId, {
        action: 'update_place',
        meta: { placeId: updated.id, data: dto },
      });
    }

    return updated;
  }

  async getAiHistory(
    userId: string,
    placeId: string,
  ): Promise<AiHistoryListResponseDto> {
    const place = await this.getPlace(userId, placeId);

    if (!place.aiContextId) {
      return { entries: [], total: 0 };
    }

    const historyItems = await this.prisma.aiHistory.findMany({
      where: { aiContextId: place.aiContextId },
      orderBy: { timestamp: 'desc' },
    });

    return {
      entries: historyItems,
      total: historyItems.length,
    };
  }

  async getAiContext(
    userId: string,
    placeId: string,
  ): Promise<AiContextResponseDto> {
    const place = await this.getPlace(userId, placeId);

    return place.aiContext;
  }

  async updateAiContext(
    userId: string,
    placeId: string,
    dto: AiContextDto,
  ): Promise<AiContextResponseDto> {
    const place = await this.getPlace(userId, placeId);

    const aiContextData: Prisma.AiContextCreateInput = {
      summary: dto.summary ?? undefined,
      keywords: dto.keywords as Prisma.JsonValue | null,
      context: dto.context ?? undefined,
      aiMeta: dto.aiMeta as Prisma.JsonValue | null,
      aiConfidence: dto.aiConfidence ?? undefined,
      aiSource: dto.aiSource ?? undefined,
    };

    let aiContext;
    if (place.aiContextId) {
      aiContext = await this.prisma.aiContext.update({
        where: { id: place.aiContextId },
        data: aiContextData,
      });
      await this.logAiHistory(aiContext.id, {
        action: 'update_ai_context',
        text: 'AI context updated',
        userPrompt: dto['userPrompt'],
        aiResponse: dto['aiResponse'],
        meta: dto.aiMeta,
      });
    } else {
      aiContext = await this.prisma.aiContext.create({
        data: aiContextData,
      });
      await this.prisma.place.update({
        where: { id: placeId },
        data: { aiContextId: aiContext.id },
      });
      await this.logAiHistory(aiContext.id, {
        action: 'create_ai_context',
        text: 'AI context created',
        userPrompt: dto['userPrompt'],
        aiResponse: dto['aiResponse'],
        meta: dto.aiMeta,
      });
    }
    return aiContext;
  }

  private async logAiHistory(
    aiContextId: string,
    log: {
      action: string;
      userPrompt?: string;
      aiResponse?: string;
      meta?: any;
      text?: string;
    },
  ) {
    if (!aiContextId) return;
    await this.prisma.aiHistory.create({
      data: {
        aiContextId,
        action: log.action,
        userPrompt: log.userPrompt,
        aiResponse: log.aiResponse,
        meta: log.meta,
        text: log.text,
      },
    });
  }

  private async getPlace(userId: string, placeId: string) {
    const place = await this.prisma.place.findUnique({
      where: { id: placeId },
      include: { aiContext: true, location: true, members: true },
    });
    if (
      !place ||
      (place.ownerId !== userId &&
        !place.members.some((m) => m.userId === userId))
    ) {
      throw new NotFoundException('Place not found');
    }
    return place;
  }
}
