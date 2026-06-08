import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccessGrantSource, BlogAccessTier, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateGrantDto, GetGrantsQueryDto } from './dto';
import { GrantListResponse, GrantResponse } from './responses';
import { GrantMapper } from './mappers';

@Injectable()
export class GrantService {
  constructor(private readonly prisma: PrismaService) {}

  async issue(dto: CreateGrantDto): Promise<GrantResponse> {
    if (dto.source === AccessGrantSource.REDEEM_CODE) {
      throw new BadRequestException(
        'REDEEM_CODE grants are created via the redeem flow',
      );
    }
    await this.assertUserExists(dto.userId);

    const grant = await this.prisma.accessGrant.create({
      data: {
        userId: dto.userId,
        tier: dto.tier ?? BlogAccessTier.PREMIUM,
        source: dto.source ?? AccessGrantSource.MANUAL,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        reference: dto.reference,
      },
    });
    return GrantMapper.toResponse(grant);
  }

  async list(query: GetGrantsQueryDto): Promise<GrantListResponse> {
    return this.listWhere(query.userId ? { userId: query.userId } : {}, query);
  }

  async listMine(
    userId: string,
    query: GetGrantsQueryDto,
  ): Promise<GrantListResponse> {
    return this.listWhere({ userId }, query); // ignores any client userId
  }

  async revoke(id: string): Promise<GrantResponse> {
    const grant = await this.prisma.accessGrant.findUnique({ where: { id } });
    if (!grant) {
      throw new NotFoundException('Grant not found');
    }
    await this.prisma.accessGrant.delete({ where: { id } });
    return GrantMapper.toResponse(grant);
  }

  private async listWhere(
    where: Prisma.AccessGrantWhereInput,
    query: GetGrantsQueryDto,
  ): Promise<GrantListResponse> {
    const [grants, total] = await this.prisma.$transaction([
      this.prisma.accessGrant.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: query.take,
        skip: query.skip,
      }),
      this.prisma.accessGrant.count({ where }),
    ]);
    return { total, grants: grants.map((g) => GrantMapper.toResponse(g)) };
  }

  private async assertUserExists(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new BadRequestException('User not found');
    }
  }
}
