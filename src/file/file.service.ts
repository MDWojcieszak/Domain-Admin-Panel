import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ImageOrientation,
  ImageProcessingStatus,
  ImageScope,
} from '@prisma/client';
import * as sharp from 'sharp';
import * as exifr from 'exifr';
import * as path from 'path';
import { existsSync, mkdirSync, unlink, writeFileSync } from 'fs';
import { v4 as uuid } from 'uuid';

type ExifFields = {
  cameraMake: string | null;
  cameraModel: string | null;
  lens: string | null;
  focalLength: number | null;
  fNumber: number | null;
  iso: number | null;
  exposureTime: string | null;
  takenAt: Date | null;
};

const EMPTY_EXIF: ExifFields = {
  cameraMake: null,
  cameraModel: null,
  lens: null,
  focalLength: null,
  fNumber: null,
  iso: null,
  exposureTime: null,
  takenAt: null,
};

const COVER_PATH = 'cover';
const ORIGINAL_PATH = 'original';
const LOW_RES_PATH = 'low_res';
const IMAGE_TYPE = 'image';

const ALL_IMAGE_DIRS = [ORIGINAL_PATH, COVER_PATH, LOW_RES_PATH];

@Injectable()
export class FileService {
  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    this.createDirectories();
  }

  private createDirectories() {
    const baseDir = '/app/public/image';

    ALL_IMAGE_DIRS.forEach((dir) => {
      const dirPath = path.join(baseDir, dir);
      if (!this.directoryExists(dirPath)) {
        try {
          mkdirSync(dirPath, { recursive: true });
          Logger.log(`Created directory: ${dirPath}`);
        } catch (error) {
          Logger.error(`Error creating directory: ${dirPath}`, error.stack);
        }
      }
    });
  }

  private directoryExists(directoryPath: string): boolean {
    try {
      return existsSync(directoryPath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Ingests a freshly uploaded image: persists the original, creates the Image
   * row (PENDING), then runs the shared pipeline. The actual derivation lives in
   * `processImage` — the SAME engine the reprocess/backfill path uses.
   */
  async uploadImage(
    image: Express.Multer.File,
    scope: ImageScope = ImageScope.GALLERY,
    uploadedById?: string,
  ) {
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
      writeFileSync(originalPath, image.buffer);

      await this.prisma.image.create({
        data: {
          id: imageId,
          originalUrl: originalPath,
          // coverUrl/lowResUrl are required — set the deterministic paths now;
          // processImage writes the files to them.
          coverUrl: coverPath,
          lowResUrl: lowResPath,
          scope,
          uploadedById,
          processingStatus: ImageProcessingStatus.PENDING,
        },
        select: { id: true },
      });

      // Shared engine — generates every derived artifact and stamps the row DONE.
      await this.processImage(imageId, image.buffer);

      return { id: imageId };
    } catch (error) {
      Logger.error(error);
      this.cleanupImageFiles(imageId);
      await this.prisma.image
        .delete({ where: { id: imageId } })
        .catch(() => undefined);
      throw new InternalServerErrorException('Error converting or saving file');
    }
  }

  /**
   * Replaces an image's original file (e.g. with a higher-quality export) and
   * rebuilds every derived artifact from it via the shared engine.
   */
  async replaceOriginal(
    imageId: string,
    file: Express.Multer.File,
  ): Promise<{ id: string }> {
    const image = await this.prisma.image.findUnique({
      where: { id: imageId },
      select: { id: true, originalUrl: true },
    });

    if (!image) throw new NotFoundException('Image not found');

    try {
      writeFileSync(image.originalUrl, file.buffer);
      await this.processImage(imageId, file.buffer);
      return { id: imageId };
    } catch (error) {
      Logger.error(error);
      await this.prisma.image
        .update({
          where: { id: imageId },
          data: {
            processingStatus: ImageProcessingStatus.FAILED,
            processingError:
              error instanceof Error ? error.message : String(error),
          },
        })
        .catch(() => undefined);
      throw new InternalServerErrorException('Error replacing original');
    }
  }

  /** Uploads many images best-effort; failures are counted, not fatal. */
  async uploadMany(
    files: Express.Multer.File[],
    scope: ImageScope = ImageScope.GALLERY,
    uploadedById?: string,
  ): Promise<{ images: { id: string }[]; uploaded: number; failed: number }> {
    const images: { id: string }[] = [];
    let failed = 0;

    for (const file of files ?? []) {
      try {
        images.push(await this.uploadImage(file, scope, uploadedById));
      } catch (error) {
        failed++;
        const message = error instanceof Error ? error.message : String(error);
        Logger.error(`Multi-upload: one image failed — ${message}`);
      }
    }

    return { images, uploaded: images.length, failed };
  }

  /**
   * THE pipeline. Turns an original buffer into every derived artifact and
   * stamps the Image row (cover/low-res webp, dimensions, orientation, DONE +
   * current pipeline version). Called by both upload and reprocess. The frontend
   * derives its blur placeholder from the cover, so none is stored here.
   */
  async processImage(imageId: string, original: Buffer): Promise<void> {
    const { width, height } = await this.getImageSize(original);

    const coverPath = this.createPath(IMAGE_TYPE, imageId, 'webp', COVER_PATH);
    const lowResPath = this.createPath(
      IMAGE_TYPE,
      imageId,
      'webp',
      LOW_RES_PATH,
    );

    await this.saveWebp(original, coverPath, 1920, 80);
    await this.saveWebp(original, lowResPath, 80, 100);

    const exif = await this.extractExif(original);

    await this.prisma.image.update({
      where: { id: imageId },
      data: {
        coverUrl: coverPath,
        lowResUrl: lowResPath,
        width,
        height,
        orientation: this.resolveOrientation(width, height),
        ...exif,
        processingStatus: ImageProcessingStatus.DONE,
        processedAt: new Date(),
        processingError: null,
      },
    });
  }

  /** Best-effort EXIF read from the original (webp variants strip it). Missing
   *  EXIF (screenshots, edited exports) is normal — returns nulls, never throws. */
  private async extractExif(buffer: Buffer): Promise<ExifFields> {
    try {
      const tags = await exifr.parse(buffer, {
        pick: [
          'Make',
          'Model',
          'LensModel',
          'LensMake',
          'FocalLength',
          'FNumber',
          'ISO',
          'ExposureTime',
          'DateTimeOriginal',
          'CreateDate',
        ],
      });

      if (!tags) return { ...EMPTY_EXIF };

      const takenAt =
        tags.DateTimeOriginal instanceof Date
          ? tags.DateTimeOriginal
          : tags.CreateDate instanceof Date
            ? tags.CreateDate
            : null;

      return {
        cameraMake: this.cleanStr(tags.Make),
        cameraModel: this.cleanStr(tags.Model),
        lens: this.cleanStr(tags.LensModel ?? tags.LensMake),
        focalLength: this.finiteOrNull(tags.FocalLength),
        fNumber: this.finiteOrNull(tags.FNumber),
        iso: this.intOrNull(tags.ISO),
        exposureTime: this.formatExposure(tags.ExposureTime),
        takenAt,
      };
    } catch {
      return { ...EMPTY_EXIF };
    }
  }

  private cleanStr(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private finiteOrNull(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private intOrNull(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value)
      ? Math.round(value)
      : null;
  }

  /** Seconds → display string, e.g. 0.004 → "1/250", 2 → "2s". */
  private formatExposure(value: unknown): string | null {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      return null;
    }
    return value >= 1
      ? `${Number(value.toFixed(1))}s`
      : `1/${Math.round(1 / value)}`;
  }

  private resolveOrientation(
    width?: number,
    height?: number,
  ): ImageOrientation {
    if (!width || !height || width === height) return ImageOrientation.SQUARE;
    return width > height
      ? ImageOrientation.LANDSCAPE
      : ImageOrientation.PORTRAIT;
  }

  private cleanupImageFiles(imageId: string) {
    for (const dir of ALL_IMAGE_DIRS) {
      const ext = dir === ORIGINAL_PATH ? 'jpg' : 'webp';
      this.unlinkFile(this.createPath(IMAGE_TYPE, imageId, ext, dir));
    }
  }

  unlinkFile(path: string) {
    // err is null on success; the callback runs on the FS thread so a throw here
    // would be uncaught (the surrounding try/catch cannot catch it).
    unlink(path, (err) => {
      if (err) Logger.log(err.message);
    });
  }

  createPath(
    fileType: string,
    fileName: string,
    fileExtension: string,
    category?: string,
  ) {
    const baseDir = '/app/public';
    return path.join(
      baseDir,
      fileType,
      category,
      `${fileName}.${fileExtension}`,
    );
  }

  async getImageSize(
    imageBuffer: Buffer,
  ): Promise<{ width: number; height: number }> {
    const metadata = await sharp(imageBuffer).metadata();
    return { width: metadata.width, height: metadata.height };
  }

  /** Resize to webp preserving aspect ratio (no crop), never upscaling. */
  async saveWebp(
    inputBuffer: Buffer,
    outputPath: string,
    maxWidth: number,
    quality: number,
  ) {
    await sharp(inputBuffer)
      .resize({
        width: maxWidth,
        fit: sharp.fit.inside,
        withoutEnlargement: true,
      })
      .webp({ quality })
      .toFile(outputPath);
  }
}
