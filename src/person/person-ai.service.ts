import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PersonAiDetailResponseDto,
  PersonAiListResponseDto,
} from './responses';
import { PersonAiCreateDto, PersonAiUpdateDto } from './dto';
import {
  AiContextResponseDto,
  AiHistoryListResponseDto,
} from '../common/responses';
import { AiContextDto } from '../common/dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class PersonAiService {
  constructor(private prisma: PrismaService) {}

  async listPersonsForAI(userId: string): Promise<PersonAiListResponseDto> {
    const persons = await this.prisma.person.findMany({
      where: { userId },
      include: { aiContext: true },
      orderBy: { name: 'asc' },
    });
    return {
      persons,
      total: persons.length,
    };
  }

  async getPersonForAI(
    userId: string,
    id: string,
  ): Promise<PersonAiDetailResponseDto> {
    const person = await this.prisma.person.findUnique({
      where: { id },
      include: { aiContext: true },
    });
    if (!person || person.userId !== userId) {
      throw new NotFoundException('Person not found');
    }
    return person;
  }

  async createPerson(
    userId: string,
    dto: PersonAiCreateDto,
  ): Promise<PersonAiDetailResponseDto> {
    const aiContext = await this.prisma.aiContext.create({ data: {} });

    const person = await this.prisma.person.create({
      data: {
        userId,
        name: dto.name,
        nickname: dto.nickname,
        email: dto.email,
        phone: dto.phone,
        notes: dto.notes,
        birthday: dto.birthday ? new Date(dto.birthday) : null,
        relation: dto.relation,
        aiContextId: aiContext.id,
      },
      include: { aiContext: true },
    });

    await this.logAiHistory(person.aiContextId, {
      action: 'create_person',
      text: 'AI person created',
      userPrompt: dto.userPrompt,
      aiResponse: dto.aiResponse,
      meta: dto.aiMeta,
    });

    return person;
  }

  async updatePerson(
    userId: string,
    id: string,
    dto: PersonAiUpdateDto,
  ): Promise<PersonAiDetailResponseDto> {
    const person = await this.prisma.person.findUnique({
      where: { id },
      include: { aiContext: true },
    });
    if (!person || person.userId !== userId) {
      throw new NotFoundException('Person not found');
    }

    const updatedPerson = await this.prisma.person.update({
      where: { id },
      data: {
        name: dto.name ?? person.name,
        nickname: dto.nickname ?? person.nickname,
        email: dto.email ?? person.email,
        phone: dto.phone ?? person.phone,
        notes: dto.notes ?? person.notes,
        birthday: dto.birthday ? new Date(dto.birthday) : person.birthday,
        relation: dto.relation ?? person.relation,
      },
      include: { aiContext: true },
    });

    await this.logAiHistory(updatedPerson.aiContextId, {
      action: 'update_person',
      text: 'AI person updated',
      userPrompt: dto.userPrompt,
      aiResponse: dto.aiResponse,
      meta: dto.aiMeta,
    });

    return person;
  }

  async getAiHistory(
    userId: string,
    personId: string,
  ): Promise<AiHistoryListResponseDto> {
    const person = await this.prisma.person.findUnique({
      where: { id: personId },
    });
    if (!person || person.userId !== userId) {
      throw new NotFoundException('Person not found');
    }
    if (!person.aiContextId) {
      return { entries: [], total: 0 };
    }

    const historyItems = await this.prisma.aiHistory.findMany({
      where: { aiContextId: person.aiContextId },
      orderBy: { timestamp: 'desc' },
    });

    return {
      entries: historyItems,
      total: historyItems.length,
    };
  }

  async getAiContext(
    userId: string,
    personId: string,
  ): Promise<AiContextResponseDto> {
    const person = await this.prisma.person.findUnique({
      where: { id: personId },
      include: { aiContext: true },
    });
    if (!person || person.userId !== userId) {
      throw new NotFoundException('Person not found');
    }
    return person.aiContext;
  }

  async updateAiContext(
    userId: string,
    personId: string,
    dto: AiContextDto,
  ): Promise<AiContextResponseDto> {
    const person = await this.prisma.person.findUnique({
      where: { id: personId },
      include: { aiContext: true },
    });
    if (!person || person.userId !== userId) {
      throw new NotFoundException('Person not found');
    }

    const aiContextData: Prisma.AiContextCreateInput &
      Prisma.AiContextUpdateInput = {
      summary: dto.summary ?? undefined,
      keywords: dto.keywords as Prisma.InputJsonValue | null,
      context: dto.context ?? undefined,
      aiMeta: dto.aiMeta as Prisma.InputJsonValue | null,
      aiConfidence: dto.aiConfidence ?? undefined,
      aiSource: dto.aiSource ?? undefined,
    };

    const aiContext = await this.prisma.aiContext.upsert({
      where: { id: person.aiContextId },
      create: aiContextData,
      update: aiContextData,
    });

    if (!person.aiContextId) {
      await this.prisma.person.update({
        where: { id: personId },
        data: { aiContextId: aiContext.id },
      });
      await this.logAiHistory(aiContext.id, {
        action: 'create_ai_context',
        text: 'AI context created',
        userPrompt: dto.userPrompt,
        aiResponse: dto.aiResponse,
        meta: dto.aiMeta,
      });
    } else {
      await this.logAiHistory(aiContext.id, {
        action: 'update_ai_context',
        text: 'AI context updated',
        userPrompt: dto.userPrompt,
        aiResponse: dto.aiResponse,
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
}
