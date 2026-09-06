import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GalleryImageRole, GalleryStatus, ImageScope } from '@prisma/client';
import { PHOTO_SIZE } from './dto';
import { createReadStream, existsSync, ReadStream } from 'fs';
import { GalleryResponseDto } from './responses';

@Injectable()
export class GalleryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * @deprecated Legacy flat listing kept alive for the old gallery front-end
   * ("project history" page). New clients use the curated `/portfolio/...` API.
   *
   * The response shape is byte-for-byte the pre-portfolio one. What did change
   * is the *set* of rows: originally this dumped every `GALLERY`-scoped image,
   * which leaked drafts and images that were uploaded but never curated. It now
   * only returns images that are actually published — part of at least one
   * PUBLISHED gallery, and not marked HIDDEN there — so it can stay `@Public()`.
   */
  async getAll(): Promise<GalleryResponseDto> {
    try {
      const images = await this.prisma.image.findMany({
        where: {
          scope: ImageScope.GALLERY,
          galleryItems: {
            some: {
              role: { not: GalleryImageRole.HIDDEN },
              gallery: { status: GalleryStatus.PUBLISHED },
            },
          },
        },
        select: {
          id: true,
          dimensions: { select: { height: true, width: true } },
          data: {
            select: {
              title: true,
              dateTaken: true,
              localization: true,
              description: true,
            },
          },
        },
        // The old dump had no ORDER BY at all. Newest-first is deterministic and
        // reads like a history feed; no client could have relied on the old order.
        orderBy: { createdAt: 'desc' },
      });
      return {
        images,
        count: images.length,
      };
    } catch (e) {
      Logger.error(e);
      throw new UnprocessableEntityException();
    }
  }

  async readImage(id: string, type: PHOTO_SIZE): Promise<ReadStream> {
    try {
      const image = await this.prisma.image.findUnique({ where: { id } });
      // Was an unguarded property access: an unknown id blew up on `null` and
      // the blanket catch below reported it as 500. It's a plain 404.
      if (!image) {
        throw new NotFoundException('Image not found');
      }
      let filePath: string;
      switch (type) {
        case PHOTO_SIZE.COVER:
          filePath = image.coverUrl;
          break;
        case PHOTO_SIZE.LOW_RES:
          filePath = image.lowResUrl;
          break;
        default:
          throw new BadRequestException('Invalid image type');
      }

      if (!existsSync(filePath)) {
        throw new ForbiddenException('File not found');
      }
      return createReadStream(filePath);
    } catch (e) {
      // Only genuinely unexpected failures (DB down, fs error) are 500s. The
      // deliberate 404/403/400 above used to be swallowed by this catch.
      if (e instanceof HttpException) throw e;
      Logger.error(e);
      throw new InternalServerErrorException('Error reading image');
    }
  }
}
