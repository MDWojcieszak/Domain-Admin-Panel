import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as sharp from 'sharp';
import * as path from 'path';
import { unlink, writeFileSync } from 'fs';
import { v4 as uuid } from 'uuid';
import { ImageService } from '../image/image.service';

const COVER_PATH = 'cover';
const ORIGINAL_PATH = 'original';
const LOW_RES_PATH = 'low_res';
const IMAGE_TYPE = 'image';

@Injectable()
export class FileService {
  constructor(private prisma: PrismaService) {}

  async uploadImage(image: Express.Multer.File) {
    const imageId = uuid();

    const originalPath = this.createPath(
      IMAGE_TYPE,
      imageId,
      'jpg',
      ORIGINAL_PATH,
    );
    const coverPath = this.createPath(IMAGE_TYPE, imageId, 'webp', COVER_PATH);
    const lowResPath = this.createPath(
      IMAGE_TYPE,
      imageId,
      'webp',
      LOW_RES_PATH,
    );
    try {
      await this.resizeCompressAndSaveImage(image.buffer, coverPath, 1920, 80);

      await this.resizeCompressAndSaveImage(image.buffer, lowResPath, 80, 100);

      writeFileSync(originalPath, image.buffer);

      const savedImage = await this.prisma.image.create({
        data: {
          id: imageId,
          originalUrl: originalPath,
          coverUrl: coverPath,
          lowResUrl: lowResPath,
        },
        select: { id: true },
      });

      return {
        id: savedImage.id,
      };
    } catch (error) {
      this.unlinkFile(originalPath);
      this.unlinkFile(coverPath);
      this.unlinkFile(lowResPath);
      throw new InternalServerErrorException('Error converting or saving file');
    }
  }

  unlinkFile(path: string) {
    unlink(path, (f) => f.message && Logger.log(f.message));
  }

  createPath(
    fileType: string,
    fileName: string,
    fileExtension: string,
    category?: string,
  ) {
    return path.join(
      __dirname,
      '../../',
      'public',
      fileType,
      category,
      `${fileName}.${fileExtension}`,
    );
  }

  async getImageSize(
    imageBuffer: Buffer,
  ): Promise<{ width: number; height: number }> {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      const { width, height } = metadata;
      return { width, height };
    } catch (error) {
      console.error('Error getting image size:', error);
      throw error;
    }
  }

  async resizeCompressAndSaveImage(
    inputBuffer: Buffer,
    outputPath: string,
    maxWidth: number,
    quality: number,
  ) {
    try {
      await sharp(inputBuffer)
        .resize({
          width: maxWidth,
          fit: sharp.fit.cover,
          withoutEnlargement: true,
        })
        .webp({ quality })
        .toFile(outputPath);
    } catch (error) {
      console.error('Error resizing and compressing image:', error);
      throw error;
    }
  }
}
