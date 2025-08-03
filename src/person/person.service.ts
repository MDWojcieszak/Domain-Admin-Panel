import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from '../common/dto';
import { PersonDetailResponseDto, PersonListResponseDto } from './responses';
import { PersonCreateDto, PersonUpdateDto } from './dto';
import { AiHistoryListResponseDto } from '../common/responses';

@Injectable()
export class PersonService {
  constructor(private prisma: PrismaService) {}
  async listPersons(
    userId: string,
    params: PaginationDto,
  ): Promise<PersonListResponseDto> {
    const { skip = 0, take = 50 } = params || {};
    const [persons, total] = await this.prisma.$transaction([
      this.prisma.person.findMany({
        where: { userId },
        include: { aiContext: true },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.person.count({ where: { userId } }),
    ]);

    return {
      persons,
      total,
      params,
    };
  }

  async getPerson(
    userId: string,
    id: string,
  ): Promise<PersonDetailResponseDto> {
    const person = await this.prisma.person.findFirst({
      where: { id, userId },
      include: { aiContext: true },
    });
    if (!person) throw new NotFoundException('Person not found');
    return person;
  }

  async createPerson(
    userId: string,
    dto: PersonCreateDto,
  ): Promise<PersonDetailResponseDto> {
    const data = { ...dto, userId };
    const person = await this.prisma.person.create({
      data,
      include: { aiContext: true },
    });
    return person;
  }

  async updatePerson(
    userId: string,
    id: string,
    dto: PersonUpdateDto,
  ): Promise<PersonDetailResponseDto> {
    const person = await this.prisma.person.findFirst({
      where: { id, userId },
      include: { aiContext: true },
    });
    if (!person) throw new NotFoundException('Person not found');

    const updated = await this.prisma.person.update({
      where: { id },
      data: dto,
      include: { aiContext: true },
    });
    return updated;
  }

  async deletePerson(
    userId: string,
    id: string,
  ): Promise<PersonDetailResponseDto> {
    const person = await this.prisma.person.findFirst({
      where: { id, userId },
      include: { aiContext: true },
    });
    if (!person) throw new NotFoundException('Person not found');

    await this.prisma.person.delete({ where: { id } });
    return person;
  }
}
