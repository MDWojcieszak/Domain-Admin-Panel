import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TagDetailResponseDto, TagListResponseDto } from './responses';
import { TagCreateDto, TagUpdateDto } from './dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TagService {
  constructor(private readonly prisma: PrismaService) {}

  async listTags(userId: string): Promise<TagListResponseDto> {
    const tags = await this.prisma.tag.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
    return {
      tags,
      total: tags.length,
    };
  }

  async createTag(
    userId: string,
    dto: TagCreateDto,
  ): Promise<TagDetailResponseDto> {
    const tag = await this.prisma.tag.create({
      data: {
        name: dto.name,
        color: dto.color,
        userId,
      },
    });
    return tag;
  }

  async updateTag(
    userId: string,
    id: string,
    dto: TagUpdateDto,
  ): Promise<TagDetailResponseDto> {
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    if (!tag) throw new NotFoundException('Tag not found');
    if (tag.userId !== userId) throw new ForbiddenException('Access denied');

    return this.prisma.tag.update({
      where: { id },
      data: {
        name: dto.name ?? tag.name,
        color: dto.color ?? tag.color,
      },
    });
  }

  async deleteTag(userId: string, id: string): Promise<TagDetailResponseDto> {
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    if (!tag) throw new NotFoundException('Tag not found');
    if (tag.userId !== userId) throw new ForbiddenException('Access denied');

    return this.prisma.tag.delete({
      where: { id },
    });
  }
}
