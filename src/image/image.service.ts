import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ImageDataDto, ImageDto, ImageSizeType } from './dto';
import { PrismaService } from '../prisma/prisma.service';
import { ReadStream, createReadStream, existsSync } from 'fs';
import { FileService } from '../file/file.service';
import { PaginationDto } from '../common/dto';

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

  async getSingle(dto: ImageDto) {
    const data = await this.prisma.imageData.findFirst({
      where: { imageId: dto.id },
      select: {
        id: true,
        author: { select: { firstName: true, lastName: true } },
        dateTaken: true,
        imageId: true,
        localization: true,
        description: true,
        title: true,
      },
    });
    return data;
  }

  async getMultiple(dto: PaginationDto) {
    const total = await this.prisma.imageData.count();
    const images = await this.prisma.imageData.findMany({
      take: dto.take,
      skip: dto.skip,
      select: {
        id: true,
        author: { select: { firstName: true, lastName: true } },
        dateTaken: true,
        imageId: true,
        localization: true,
        description: true,
        title: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return { images, total, params: { ...dto } };
  }

  async readImage(id: string, type: ImageSizeType): Promise<ReadStream> {
    try {
      const image = await this.prisma.image.findUnique({ where: { id } });
      let filePath: string;
      switch (type) {
        case ImageSizeType.ORIGINAL:
          filePath = image.originalUrl;
          break;
        case ImageSizeType.COVER:
          filePath = image.coverUrl;
          break;
        case ImageSizeType.LOW_RES:
          filePath = image.lowResUrl;
          break;
        default:
          throw new ForbiddenException('Invalid image type');
      }

      if (!existsSync(filePath)) {
        throw new ForbiddenException('File not found');
      }
      return createReadStream(filePath);
    } catch (_) {
      throw new ForbiddenException('Error reading the image');
    }
  }

  async delete(dto: ImageDto) {
    const image = await this.get(dto);
    try {
      await this.prisma.image.delete({
        where: {
          id: dto.id,
        },
      });
    } catch (e) {
      Logger.error(e);
      throw new NotFoundException();
    }
    try {
      this.fileService.unlinkFile(image.originalUrl);
      this.fileService.unlinkFile(image.coverUrl);
      this.fileService.unlinkFile(image.lowResUrl);
    } catch (e) {
      Logger.log(e);
      throw new InternalServerErrorException('Error deleting files');
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

  async updateData(dto: ImageDto, data: Partial<ImageDataDto>) {
    const image = await this.get({ id: dto.id });
    try {
      await this.prisma.imageData.update({
        where: { id: image.data.id },
        data,
      });
    } catch (e) {
      Logger.error(e);
      throw new UnprocessableEntityException();
    }
  }
}
