import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { PatchHomeConfigDto, SetHomePinsDto } from './dto';
import { HomeConfigResponse, HomePinsResponse } from './responses';

@Injectable()
export class HomeService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(): Promise<HomeConfigResponse> {
    const config = await this.ensureConfig();
    return {
      id: config.id,
      postCount: config.postCount,
      updatedAt: config.updatedAt,
    };
  }

  async patchConfig(dto: PatchHomeConfigDto): Promise<HomeConfigResponse> {
    const config = await this.ensureConfig();
    const updated = await this.prisma.homeConfig.update({
      where: { id: config.id },
      data: { postCount: dto.postCount },
    });
    return {
      id: updated.id,
      postCount: updated.postCount,
      updatedAt: updated.updatedAt,
    };
  }

  async getPins(): Promise<HomePinsResponse> {
    const posts = await this.prisma.blogPost.findMany({
      where: { homePosition: { not: null } },
      select: { id: true, slug: true, homePosition: true },
      orderBy: { homePosition: 'asc' },
    });
    return {
      pins: posts.map((p) => ({
        postId: p.id,
        slug: p.slug,
        position: p.homePosition!,
      })),
    };
  }

  /** Set-replaces the full pin set: posts not listed are unpinned. */
  async setPins(dto: SetHomePinsDto): Promise<HomePinsResponse> {
    const positions = dto.pins.map((p) => p.position);
    const postIds = dto.pins.map((p) => p.postId);
    if (new Set(positions).size !== positions.length) {
      throw new BadRequestException('Duplicate position');
    }
    if (new Set(postIds).size !== postIds.length) {
      throw new BadRequestException('Duplicate postId');
    }
    if (postIds.length > 0) {
      const found = await this.prisma.blogPost.count({
        where: { id: { in: postIds } },
      });
      if (found !== postIds.length) {
        throw new BadRequestException('One or more posts not found');
      }
    }

    await this.prisma.$transaction([
      this.prisma.blogPost.updateMany({
        where: { homePosition: { not: null } },
        data: { homePosition: null },
      }),
      ...dto.pins.map((p) =>
        this.prisma.blogPost.update({
          where: { id: p.postId },
          data: { homePosition: p.position },
        }),
      ),
    ]);

    return this.getPins();
  }

  /** The homepage config is a singleton; create it lazily on first access. */
  private async ensureConfig() {
    const existing = await this.prisma.homeConfig.findFirst();
    return existing ?? this.prisma.homeConfig.create({ data: {} });
  }
}
