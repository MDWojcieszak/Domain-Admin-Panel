import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ImageDataDto, ImageDto, ImageSizeType, PaginationDto } from './dto';
import { PrismaService } from '../prisma/prisma.service';
import { ReadStream, createReadStream } from 'fs';
import { FileService } from '../file/file.service';

@Injectable()
export class ImageService {
  constructor(
    private prisma: PrismaService,
    private fileService: FileService,
  ) {}

  async get(dto: ImageDto) {
    const image = await this.prisma.image.findUnique({
      where: { id: dto.id },
      select: {
        data: { select: { id: true } },
        coverUrl: true,
        id: true,
        lowResUrl: true,
        originalUrl: true,
      },
    });
    if (!image) throw new ForbiddenException();
    return image;
  }

  async getMultiple(dto: PaginationDto) {
    const total = await this.prisma.image.count();
    const images = await this.prisma.image.findMany({
      take: dto.take,
      skip: dto.skip,
    });
    return { images, total, params: { ...dto } };
  }

  async readImage(id: string, type: ImageSizeType): Promise<ReadStream> {
    try {
      const image = await this.prisma.image.findUnique({ where: { id } });
      switch (type) {
        case ImageSizeType.ORIGINAL:
          return createReadStream(image.originalUrl);
        case ImageSizeType.COVER:
          return createReadStream(image.coverUrl);
        case ImageSizeType.LOW_RES:
          return createReadStream(image.lowResUrl);
      }
    } catch (_) {
      throw new ForbiddenException();
    }
  }

  async delete(dto: ImageDto) {
    const image = await this.get(dto);
    try {
      this.fileService.unlinkFile(image.originalUrl);
      this.fileService.unlinkFile(image.coverUrl);
      this.fileService.unlinkFile(image.lowResUrl);
    } catch (e) {
      Logger.log(e);
      throw new InternalServerErrorException('Error deleting files');
    }
    try {
      await this.prisma.image.delete({
        where: {
          id: dto.id,
        },
      });
    } catch (e) {
      throw new ForbiddenException();
    }
  }

  async createData(dto: ImageDataDto, userId: string) {
    const image = await this.get({ id: dto.imageId });
    if (image?.data?.id)
      throw new UnprocessableEntityException('Image Data already exists');

    try {
      await this.prisma.imageData.create({
        data: {
          dateTaken: dto.dateTaken,
          localization: dto.localization,
          author: dto.authorId ? { connect: { id: dto.authorId } } : undefined,
          createdBy: { connect: { id: userId } },
          image: { connect: { id: image.id } },
          description: dto.description,
          title: dto.title,
        },
      });
    } catch (e) {
      Logger.error(e);
      throw new InternalServerErrorException();
    }
  }
}
