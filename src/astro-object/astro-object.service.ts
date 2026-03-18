import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import {
  CreateAstroObjectDto,
  GetAstroObjectsQueryDto,
  PatchAstroObjectDto,
} from './dto';
import {
  AstroObjectDetailsResponse,
  AstroObjectListResponse,
  AstroObjectResponse,
} from './responses';
import { AstroObjectMapper } from './mappers';
import { PhotoStorageService } from '../photo-storage-service/photo-storage.service';

@Injectable()
export class AstroObjectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly photoStorageService: PhotoStorageService,
  ) {}

  async list(
    query?: GetAstroObjectsQueryDto,
  ): Promise<AstroObjectListResponse> {
    const where = query?.search
      ? {
          OR: [
            {
              name: {
                contains: query.search,
                mode: 'insensitive' as const,
              },
            },
            {
              code: {
                contains: query.search,
                mode: 'insensitive' as const,
              },
            },
          ],
        }
      : undefined;

    const take = query?.take;
    const skip = query?.skip;

    const [astroObjects, total] = await this.prisma.$transaction([
      this.prisma.astroObject.findMany({
        where,
        orderBy: [{ code: 'asc' }, { name: 'asc' }],
        take,
        skip,
      }),
      this.prisma.astroObject.count({ where }),
    ]);

    return {
      total,
      astroObjects: astroObjects.map((astroObject) =>
        AstroObjectMapper.toResponse(astroObject),
      ),
    };
  }

  async getById(id: string): Promise<AstroObjectDetailsResponse> {
    const astroObject = await this.prisma.astroObject.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            photoLinks: true,
          },
        },
      },
    });

    if (!astroObject) {
      throw new NotFoundException('AstroObject not found');
    }

    return AstroObjectMapper.toDetailsResponse(astroObject);
  }

  async create(dto: CreateAstroObjectDto): Promise<AstroObjectResponse> {
    const code = dto.code ? this.normalizeCode(dto.code) : undefined;
    const normalizedName = this.normalizePathPart(dto.name);

    const created = await this.prisma.astroObject.create({
      data: {
        name: dto.name,
        code,
        thumbnailUrl: dto.thumbnailUrl,
      },
    });

    await this.photoStorageService.ensureAstroObjectStructure(
      created.code ?? undefined,
      normalizedName,
    );

    return AstroObjectMapper.toResponse(created);
  }

  async patch(
    id: string,
    dto: PatchAstroObjectDto,
  ): Promise<AstroObjectResponse> {
    const existing = await this.prisma.astroObject.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            photoLinks: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('AstroObject not found');
    }

    const newCode =
      dto.code !== undefined
        ? this.normalizeOptionalCode(dto.code)
        : existing.code;

    const updated = await this.prisma.astroObject.update({
      where: { id },
      data: {
        name: dto.name,
        code: newCode,
        thumbnailUrl: dto.thumbnailUrl,
      },
    });

    return AstroObjectMapper.toResponse(updated);
  }

  private normalizeOptionalCode(
    value?: string | null,
  ): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    const normalized = this.normalizeCode(value);

    return normalized.length > 0 ? normalized : null;
  }

  private normalizeCode(value: string): string {
    return value
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '')
      .replace(/^([A-Z]+)(\d+)$/, '$1_$2')
      .replace(/^([A-Z]+\d+)(\d+)$/, '$1_$2')
      .replace(/[^A-Z0-9_]/g, '')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private normalizePathPart(value: string): string {
    return value
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ł/g, 'l')
      .replace(/Ł/g, 'L')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_');
  }
}
