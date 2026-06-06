import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MediaStatus,
  PhotoEntry,
  PhotoEntryType,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { PhotoStorageService } from '../photo-storage-service/photo-storage.service';

import {
  CreatePhotoEntryDto,
  GetPhotoEntriesQueryDto,
  PatchPhotoEntryDto,
  PatchPhotoEntryStatusDto,
} from './dto';
import {
  PhotoEntryDetailsResponse,
  PhotoEntryListResponse,
  PhotoEntryResponse,
} from './responses';
import { PhotoEntryMapper } from './mappers';

type PhotoEntryWithAstroObjects = PhotoEntry & {
  astroObjects: Array<{
    id: string;
    photoEntryId: string;
    astroObjectId: string;
    rootPath: string | null;
    createdAt: Date;
    updatedAt: Date;
    astroObject: {
      id: string;
      name: string;
      code: string | null;
      thumbnailUrl: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
  }>;
  _count?: {
    astroObjects: number;
  };
};

@Injectable()
export class PhotoEntryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly photoStorageService: PhotoStorageService,
  ) {}

  async list(
    userId: string,
    query?: GetPhotoEntriesQueryDto,
  ): Promise<PhotoEntryListResponse> {
    const where: Prisma.PhotoEntryWhereInput = {
      userId,
      ...(query?.type ? { type: query.type } : {}),
      ...(query?.status ? { status: query.status } : {}),
      ...(query?.astroObjectId
        ? {
            astroObjects: {
              some: {
                astroObjectId: query.astroObjectId,
              },
            },
          }
        : {}),
      ...(query?.search
        ? {
            OR: [
              {
                name: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                rootPath: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [photoEntries, total] = await this.prisma.$transaction([
      this.prisma.photoEntry.findMany({
        where,
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
        take: query?.take,
        skip: query?.skip,
      }),
      this.prisma.photoEntry.count({ where }),
    ]);

    return {
      total,
      photoEntries: photoEntries.map((photoEntry) =>
        PhotoEntryMapper.toResponse(photoEntry),
      ),
    };
  }

  async getById(
    userId: string,
    id: string,
  ): Promise<PhotoEntryDetailsResponse> {
    const photoEntry = await this.prisma.photoEntry.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        astroObjects: {
          include: {
            astroObject: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        _count: {
          select: {
            astroObjects: true,
          },
        },
      },
    });

    if (!photoEntry) {
      throw new NotFoundException('PhotoEntry not found');
    }

    return PhotoEntryMapper.toDetailsResponse(photoEntry);
  }

  async create(
    userId: string,
    dto: CreatePhotoEntryDto,
  ): Promise<PhotoEntryResponse> {
    this.assertAstroDtoConsistency(dto.type, dto.astroObjectIds);
    this.assertValidDateRange(dto.startDate, dto.endDate);

    const astroObjects =
      dto.type === PhotoEntryType.ASTRO && dto.astroObjectIds?.length
        ? await this.loadAstroObjects(dto.astroObjectIds)
        : [];

    const created = await this.prisma.$transaction(async (tx) => {
      const photoEntry = await tx.photoEntry.create({
        data: {
          name: dto.name,
          type: dto.type,
          status: dto.status,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          rootPath: null,
          foldersCreated: false,
          foldersCreatedAt: null,
          userId,
        },
      });

      if (dto.type === PhotoEntryType.ASTRO && astroObjects.length > 0) {
        await tx.photoEntryAstroObject.createMany({
          data: astroObjects.map((astroObject) => ({
            photoEntryId: photoEntry.id,
            astroObjectId: astroObject.id,
            rootPath: null,
          })),
        });
      }

      return photoEntry;
    });

    return PhotoEntryMapper.toResponse(created);
  }

  async patch(
    userId: string,
    id: string,
    dto: PatchPhotoEntryDto,
  ): Promise<PhotoEntryResponse> {
    const existing = await this.getEntryWithAstroObjectsOrThrow(id, userId);

    if (dto.type && dto.type !== existing.type) {
      throw new BadRequestException('Changing entry type is not supported');
    }

    this.assertAstroDtoConsistency(existing.type, dto.astroObjectIds);

    const nextStartDateValue =
      dto.startDate !== undefined
        ? dto.startDate
        : existing.startDate
          ? existing.startDate.toISOString()
          : undefined;

    const nextEndDateValue =
      dto.endDate !== undefined
        ? dto.endDate
        : existing.endDate
          ? existing.endDate.toISOString()
          : undefined;

    this.assertValidDateRange(nextStartDateValue, nextEndDateValue);

    if (existing.foldersCreated) {
      this.assertNoFolderShapeChangesAfterCreation(existing, dto);
    }

    const nextStartDate =
      dto.startDate !== undefined
        ? dto.startDate
          ? new Date(dto.startDate)
          : null
        : existing.startDate;

    const nextEndDate =
      dto.endDate !== undefined
        ? dto.endDate
          ? new Date(dto.endDate)
          : null
        : existing.endDate;

    const nextAstroObjects =
      existing.type === PhotoEntryType.ASTRO && dto.astroObjectIds
        ? await this.loadAstroObjects(dto.astroObjectIds)
        : null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const photoEntry = await tx.photoEntry.update({
        where: { id: existing.id },
        data: {
          name: dto.name,
          startDate: nextStartDate,
          endDate: nextEndDate,
        },
      });

      if (
        existing.type === PhotoEntryType.ASTRO &&
        nextAstroObjects &&
        !existing.foldersCreated
      ) {
        await tx.photoEntryAstroObject.deleteMany({
          where: {
            photoEntryId: existing.id,
          },
        });

        if (nextAstroObjects.length > 0) {
          await tx.photoEntryAstroObject.createMany({
            data: nextAstroObjects.map((astroObject) => ({
              photoEntryId: existing.id,
              astroObjectId: astroObject.id,
              rootPath: null,
            })),
          });
        }
      }

      return photoEntry;
    });

    return PhotoEntryMapper.toResponse(updated);
  }

  async patchStatus(
    userId: string,
    id: string,
    dto: PatchPhotoEntryStatusDto,
  ): Promise<PhotoEntryResponse> {
    const existing = await this.getEntryWithAstroObjectsOrThrow(id, userId);

    const updated = await this.prisma.photoEntry.update({
      where: { id: existing.id },
      data: {
        status: dto.status,
      },
    });

    return PhotoEntryMapper.toResponse(updated);
  }

  async createFolders(userId: string, id: string): Promise<PhotoEntryResponse> {
    const existing = await this.getEntryWithAstroObjectsOrThrow(id, userId);

    if (existing.foldersCreated) {
      throw new BadRequestException('Folders have already been created');
    }

    const generated = this.buildPathsForEntry(existing);
    const foldersCreatedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      if (existing.type === PhotoEntryType.GENERAL) {
        if (!generated.entryRootPath) {
          throw new BadRequestException('Could not generate GENERAL rootPath');
        }

        const year = this.resolveEntryYear(existing);

        await this.photoStorageService.ensureYearStructure(year);
        await this.photoStorageService.ensureGeneralEntryStructure(
          generated.entryRootPath,
        );

        await tx.photoEntry.update({
          where: { id: existing.id },
          data: {
            rootPath: generated.entryRootPath,
            foldersCreated: true,
            foldersCreatedAt,
          },
        });

        return;
      }

      if (existing.type === PhotoEntryType.WORK) {
        if (!generated.entryRootPath) {
          throw new BadRequestException('Could not generate WORK rootPath');
        }

        await this.photoStorageService.ensureWorkEntryStructure(
          generated.entryRootPath,
        );

        await tx.photoEntry.update({
          where: { id: existing.id },
          data: {
            rootPath: generated.entryRootPath,
            foldersCreated: true,
            foldersCreatedAt,
          },
        });

        return;
      }

      if (existing.type === PhotoEntryType.ASTRO) {
        if (!existing.astroObjects.length || !generated.entryRootPath) {
          throw new BadRequestException(
            'ASTRO entry requires related astro objects',
          );
        }
        const year = this.resolveEntryYear(existing);

        await this.photoStorageService.ensureYearStructure(year);
        await this.photoStorageService.ensureGeneralEntryStructure(
          generated.entryRootPath,
        );

        for (const astroLink of existing.astroObjects) {
          const astroRootPath = generated.astroRootPathsByLinkId[astroLink.id];

          if (!astroRootPath) {
            throw new BadRequestException(
              `Could not generate astro rootPath for link ${astroLink.id}`,
            );
          }

          await this.photoStorageService.ensureAstroObjectStructure(
            astroLink.astroObject.code ?? undefined,
            this.normalizePathPart(astroLink.astroObject.name),
          );
          await this.photoStorageService.ensureAstroEntryStructure(
            astroRootPath,
          );

          await tx.photoEntryAstroObject.update({
            where: { id: astroLink.id },
            data: {
              rootPath: astroRootPath,
            },
          });
        }

        await tx.photoEntry.update({
          where: { id: existing.id },
          data: {
            rootPath: generated.entryRootPath,
            foldersCreated: true,
            foldersCreatedAt,
          },
        });
      }
    });

    const updated = await this.prisma.photoEntry.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!updated) {
      throw new NotFoundException('PhotoEntry not found after folder creation');
    }

    return PhotoEntryMapper.toResponse(updated);
  }

  async markMediaUploaded(id: string): Promise<PhotoEntryResponse> {
    const updated = await this.prisma.photoEntry.update({
      where: { id },
      data: {
        uploadStatus: MediaStatus.UPLOADED,
      },
    });
    if (!updated) {
      throw new NotFoundException('PhotoEntry not found after folder creation');
    }
    return PhotoEntryMapper.toResponse(updated);
  }

  async delete(userId: string, id: string): Promise<PhotoEntryResponse> {
    const existing = await this.getEntryWithAstroObjectsOrThrow(id, userId);
    if (existing.foldersCreated) {
      throw new BadRequestException('Cannot delete entry with created folders');
    }

    await this.prisma.photoEntry.delete({
      where: { id: existing.id },
    });

    return PhotoEntryMapper.toResponse(existing);
  }

  private async getEntryWithAstroObjectsOrThrow(
    id: string,
    userId: string,
  ): Promise<PhotoEntryWithAstroObjects> {
    const photoEntry = await this.prisma.photoEntry.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        astroObjects: {
          include: {
            astroObject: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        _count: {
          select: {
            astroObjects: true,
          },
        },
      },
    });

    if (!photoEntry) {
      throw new NotFoundException('PhotoEntry not found');
    }

    return photoEntry;
  }

  private async loadAstroObjects(astroObjectIds: string[]): Promise<
    Array<{
      id: string;
      name: string;
      code: string | null;
      thumbnailUrl: string | null;
    }>
  > {
    if (astroObjectIds.length === 0) {
      return [];
    }

    const uniqueIds = [...new Set(astroObjectIds)];

    const astroObjects = await this.prisma.astroObject.findMany({
      where: {
        id: {
          in: uniqueIds,
        },
      },
      select: {
        id: true,
        name: true,
        code: true,
        thumbnailUrl: true,
      },
    });

    if (astroObjects.length !== uniqueIds.length) {
      throw new NotFoundException('One or more AstroObjects were not found');
    }

    return astroObjects;
  }

  private assertAstroDtoConsistency(
    type: PhotoEntryType,
    astroObjectIds?: string[],
  ): void {
    if (type === PhotoEntryType.ASTRO) {
      if (!astroObjectIds || astroObjectIds.length === 0) {
        throw new BadRequestException(
          'ASTRO entry requires at least one astroObjectId',
        );
      }

      return;
    }

    if (astroObjectIds && astroObjectIds.length > 0) {
      throw new BadRequestException(
        'astroObjectIds can be used only for ASTRO entries',
      );
    }
  }

  private assertValidDateRange(
    startDate?: string | null,
    endDate?: string | null,
  ): void {
    if (!startDate || !endDate) {
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date range');
    }

    if (end.getTime() < start.getTime()) {
      throw new BadRequestException('endDate cannot be earlier than startDate');
    }
  }

  private assertNoFolderShapeChangesAfterCreation(
    existing: PhotoEntryWithAstroObjects,
    dto: PatchPhotoEntryDto,
  ): void {
    if (dto.name !== undefined && dto.name !== existing.name) {
      throw new BadRequestException(
        'name cannot be changed after folders were created',
      );
    }

    const existingStartDate = existing.startDate
      ? existing.startDate.toISOString()
      : null;
    const existingEndDate = existing.endDate
      ? existing.endDate.toISOString()
      : null;

    if (
      dto.startDate !== undefined &&
      (dto.startDate ?? null) !== existingStartDate
    ) {
      throw new BadRequestException(
        'startDate cannot be changed after folders were created',
      );
    }

    if (
      dto.endDate !== undefined &&
      (dto.endDate ?? null) !== existingEndDate
    ) {
      throw new BadRequestException(
        'endDate cannot be changed after folders were created',
      );
    }

    if (dto.astroObjectIds !== undefined) {
      const currentIds = existing.astroObjects
        .map((item) => item.astroObjectId)
        .sort();

      const nextIds = [...dto.astroObjectIds].sort();

      const changed =
        currentIds.length !== nextIds.length ||
        currentIds.some((value, index) => value !== nextIds[index]);

      if (changed) {
        throw new BadRequestException(
          'astroObjectIds cannot be changed after folders were created',
        );
      }
    }
  }

  private buildPathsForEntry(photoEntry: PhotoEntryWithAstroObjects): {
    entryRootPath: string | null;
    astroRootPathsByLinkId: Record<string, string>;
  } {
    const normalizedName = this.normalizePathPart(photoEntry.name);
    const year = this.resolveEntryYear(photoEntry);
    const daysCount = this.calculateDaysCount(
      photoEntry.startDate,
      photoEntry.endDate,
    );

    const entryFolderName = this.buildEntryFolderName({
      startDate: photoEntry.startDate,
      year,
      daysCount,
      normalizedName,
    });

    if (photoEntry.type === PhotoEntryType.GENERAL) {
      return {
        entryRootPath: `${year}/${entryFolderName}`,
        astroRootPathsByLinkId: {},
      };
    }

    if (photoEntry.type === PhotoEntryType.WORK) {
      return {
        entryRootPath: `WORK/${year}/${entryFolderName}`,
        astroRootPathsByLinkId: {},
      };
    }

    const astroRootPathsByLinkId: Record<string, string> = {};

    for (const astroLink of photoEntry.astroObjects) {
      const objectFolderName =
        this.photoStorageService.buildAstroObjectFolderName(
          astroLink.astroObject.code ?? undefined,
          this.normalizePathPart(astroLink.astroObject.name),
        );

      astroRootPathsByLinkId[astroLink.id] =
        `ASTRO_OBJECTS/${objectFolderName}/${entryFolderName}`;
    }

    return {
      entryRootPath: `${year}/${entryFolderName}`,
      astroRootPathsByLinkId,
    };
  }

  private resolveEntryYear(photoEntry: {
    startDate?: Date | null;
    createdAt?: Date;
  }): number {
    if (photoEntry.startDate) {
      return photoEntry.startDate.getFullYear();
    }

    if (photoEntry.createdAt) {
      return photoEntry.createdAt.getFullYear();
    }

    return new Date().getFullYear();
  }

  private calculateDaysCount(
    startDate?: Date | null,
    endDate?: Date | null,
  ): number | undefined {
    if (!startDate || !endDate) {
      return undefined;
    }

    const difference = endDate.getTime() - startDate.getTime();

    if (difference < 0) {
      throw new BadRequestException('endDate cannot be earlier than startDate');
    }

    return Math.ceil(difference / (1000 * 60 * 60 * 24)) + 1;
  }

  private buildEntryFolderName(params: {
    startDate?: Date | null;
    endDate?: Date | null;
    year: number;
    daysCount?: number;
    normalizedName: string;
  }): string {
    const datePart = params.startDate
      ? this.formatDate(params.startDate)
      : `${params.year}`;

    const resolvedDaysCount =
      params.daysCount ??
      (params.startDate
        ? params.endDate
          ? this.calculateInclusiveDays(params.startDate, params.endDate)
          : 1
        : undefined);

    const durationPart =
      resolvedDaysCount != null
        ? `__${String(resolvedDaysCount).padStart(2, '0')}D`
        : '';

    return `${datePart}${durationPart}____${params.normalizedName}`;
  }

  private calculateInclusiveDays(startDate: Date, endDate: Date): number {
    const start = new Date(startDate);
    const end = new Date(endDate);

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

    return Math.max(diffDays, 1);
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
      .replace(/_+/g, '_')
      .toUpperCase();
  }

  private formatDate(value: Date): string {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');

    return `${year}_${month}_${day}`;
  }
}
