import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PHOTO_SIZE } from './dto';
import { createReadStream, existsSync, ReadStream } from 'fs';

@Injectable()
export class GalleryService {
  constructor(private readonly prisma: PrismaService) {}
  async getAll() {
    try {
      const images = await this.prisma.image.findMany({
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
    } catch (_) {
      throw new InternalServerErrorException('Error reading image');
    }
  }
}
