import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ImageScope,
  PhotoEntry,
  PhotoEntryPublication,
  PhotoEntryType,
  PublicationStatus,
} from '@prisma/client';
import { readFile, realpath, stat } from 'fs/promises';
import { basename } from 'path';
import * as sharp from 'sharp';

import { FileService } from '../../file/file.service';
import { GalleriesService } from '../../galleries/galleries.service';
import {
  ENTRY_STRUCTURES,
  PhotoEntryFolderRole,
} from '../../photo-storage-service/entry-structure';
import { PhotoStorageService } from '../../photo-storage-service/photo-storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { isIgnoredDir } from '../counts/folder-counts';
import { ExportPreviewQueryDto, PublishExportsDto } from './dto';
import {
  classifyExportFile,
  decodeKey,
  derivePreviewSecret,
  encodeKey,
  ExportFileKind,
  ExportFileStatus,
  exportFileStatus,
  ExportFormat,
  isInside,
  needsConversion,
  fileVersion,
  previewCacheName,
  previewExpiry,
  PreviewSize,
  previewUrl,
  publishAction,
  verifyPreview,
} from './export-files';
import { PreviewCacheService } from './preview-cache.service';
import {
  ExportFileResponse,
  ExportScanResponse,
  PublishExportsResponse,
} from './responses';

/** Entry types with a single export folder (v1, §2.7). */
const STRUCTURE: Partial<Record<PhotoEntryType, 'general' | 'work'>> = {
  [PhotoEntryType.GENERAL]: 'general',
  [PhotoEntryType.WORK]: 'work',
};
/** Parallel stat/header reads during a scan — gentle on a NAS. */
const SCAN_CONCURRENCY = 8;

interface ResolvedFile {
  relativePath: string;
  absolutePath: string;
  size: number;
  mtime: Date;
  kind: ExportFileKind;
}

/**
 * Publishing from an entry's export folder
 * (docs/photo-entry-planning-and-publish.md §2): on-demand scan with signed
 * preview URLs, then a background worker that uploads the chosen files from
 * disk through the same pipeline as a panel upload.
 */
@Injectable()
export class ExportService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ExportService.name);
  private readonly draining = new Set<string>();
  private readonly secret: string | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: PhotoStorageService,
    private readonly previews: PreviewCacheService,
    private readonly files: FileService,
    private readonly galleries: GalleriesService,
    config: ConfigService,
  ) {
    const appSecret = config.get<string>('JWT_SECRET');
    this.secret = appSecret ? derivePreviewSecret(appSecret) : null;
  }

  /** Picks up publications interrupted by a restart. */
  async onApplicationBootstrap(): Promise<void> {
    const pending = await this.prisma.photoEntryPublication
      .findMany({
        where: { status: PublicationStatus.PENDING },
        select: { photoEntryId: true },
        distinct: ['photoEntryId'],
      })
      .catch(() => []);
    for (const { photoEntryId } of pending) this.startDrain(photoEntryId);
  }

  // --------------------------------------------------------------- scan

  async scan(userId: string, entryId: string): Promise<ExportScanResponse> {
    const entry = await this.getOwnedEntry(userId, entryId);
    const folder = exportFolderOf(entry);
    const secret = this.requireSecret();

    const listing = await this.storage.listFiles(
      `${entry.rootPath}/${folder}`,
      (_dir, name) => isIgnoredDir(name),
    );
    const now = new Date();
    const exp = previewExpiry(Math.floor(now.getTime() / 1000));

    const candidates = (listing?.files ?? [])
      .map((relativePath) => ({
        relativePath,
        kind: classifyExportFile(basename(relativePath)),
      }))
      .filter(
        (c): c is { relativePath: string; kind: ExportFileKind } => !!c.kind,
      );

    const rows = await this.prisma.photoEntryPublication.findMany({
      where: { photoEntryId: entry.id },
    });
    const byPath = new Map(rows.map((r) => [r.relativePath, r]));

    const files = (
      await mapLimited(candidates, SCAN_CONCURRENCY, async (c) => {
        const absolutePath = this.storage.buildAbsolutePath(
          `${entry.rootPath}/${folder}/${c.relativePath}`,
        );
        const info = await stat(absolutePath).catch(() => null);
        if (!info?.isFile()) return null;
        const dims = c.kind.publishable
          ? await dimensionsOf(absolutePath)
          : null;
        return this.toFileResponse(
          entry.id,
          secret,
          exp,
          {
            relativePath: c.relativePath,
            absolutePath,
            size: info.size,
            mtime: info.mtime,
            kind: c.kind,
          },
          dims,
          byPath.get(c.relativePath) ?? null,
        );
      })
    )
      .filter((f): f is ExportFileResponse => !!f)
      .sort((a, b) =>
        a.relativePath.localeCompare(b.relativePath, undefined, {
          numeric: true,
        }),
      );

    const count = (s: ExportFileStatus) =>
      files.filter((f) => f.status === s).length;
    return {
      photoEntryId: entry.id,
      folder,
      folderExists: listing !== null,
      scannedAt: now,
      urlsExpireAt: new Date(exp * 1000),
      files,
      summary: {
        total: files.length,
        new: count(ExportFileStatus.NEW),
        pending: count(ExportFileStatus.PENDING),
        published: count(ExportFileStatus.PUBLISHED),
        changed: count(ExportFileStatus.CHANGED),
        failed: count(ExportFileStatus.FAILED),
      },
    };
  }

  // ------------------------------------------------------------ preview

  /**
   * Serves a preview for a signed URL. No session: the signature, issued by
   * an authorised scan, IS the authorisation (Q3).
   */
  async preview(
    entryId: string,
    query: ExportPreviewQueryDto,
  ): Promise<string> {
    const secret = this.requireSecret();
    if (!verifyPreview(secret, { entryId, ...query })) {
      throw new ForbiddenException('Invalid or expired preview link');
    }
    const entry = await this.prisma.photoEntry.findUnique({
      where: { id: entryId },
    });
    if (!entry) throw new NotFoundException('PhotoEntry not found');

    const file = await this.resolveFile(entry, query.key);
    if (!file.kind.publishable) {
      throw new BadRequestException(
        file.kind.reason ?? 'No preview for this file',
      );
    }
    return this.previews.get(
      file.absolutePath,
      previewCacheName(
        entry.id,
        file.relativePath,
        file.size,
        file.mtime.getTime(),
        query.size,
      ),
      query.size,
    );
  }

  // ------------------------------------------------------------ publish

  async publish(
    userId: string,
    entryId: string,
    dto: PublishExportsDto,
  ): Promise<PublishExportsResponse> {
    const entry = await this.getOwnedEntry(userId, entryId);
    if (!!dto.galleryId === !!dto.newGallery) {
      throw new BadRequestException(
        'Choose exactly one target: galleryId or newGallery',
      );
    }

    const keys = [...new Set(dto.keys)];
    const resolved = await Promise.all(
      keys.map((k) => this.resolveFile(entry, k)),
    );
    const refused = resolved.filter((f) => !f.kind.publishable);
    if (refused.length) {
      throw new BadRequestException(
        `Not publishable: ${refused.map((f) => basename(f.relativePath)).join(', ')}`,
      );
    }

    const galleryId = dto.galleryId
      ? await this.existingGallery(dto.galleryId)
      : (
          await this.galleries.create(userId, {
            title: dto.newGalleryTitle?.trim() || entry.name,
          })
        ).id; // created as DRAFT — publishing photos never publishes a page (Q5)

    const rows = await this.prisma.photoEntryPublication.findMany({
      where: { photoEntryId: entry.id },
    });
    const byPath = new Map(rows.map((r) => [r.relativePath, r]));
    let position =
      rows.reduce((max, r) => Math.max(max, r.queuePosition), -1) + 1;

    let queued = 0;
    const skipped: PublishExportsResponse['skipped'] = [];
    for (const [i, file] of resolved.entries()) {
      const row = byPath.get(file.relativePath) ?? null;
      const status = exportFileStatus(row, file);
      if (publishAction(status, !!row?.imageId) === 'skip') {
        skipped.push({
          key: keys[i],
          name: basename(file.relativePath),
          status,
        });
        continue;
      }
      await this.prisma.photoEntryPublication.upsert({
        where: {
          photoEntryId_relativePath: {
            photoEntryId: entry.id,
            relativePath: file.relativePath,
          },
        },
        create: {
          photoEntryId: entry.id,
          relativePath: file.relativePath,
          status: PublicationStatus.PENDING,
          galleryId,
          requestedById: userId,
          queuePosition: position++,
        },
        update: {
          status: PublicationStatus.PENDING,
          galleryId,
          requestedById: userId,
          queuePosition: position++,
          error: null,
        },
      });
      queued++;
    }

    if (queued > 0) this.startDrain(entry.id);
    return { galleryId, queued, skipped };
  }

  // ------------------------------------------------------------- worker

  private startDrain(entryId: string): void {
    this.drain(entryId).catch((err) =>
      this.logger.error(
        `Publishing for entry ${entryId} stopped: ${(err as Error).message}`,
      ),
    );
  }

  /**
   * One file at a time per entry: a 50 MB export is read whole into memory,
   * and the NAS is happier with sequential reads. New rows queued while this
   * runs are picked up by the same loop.
   */
  private async drain(entryId: string): Promise<void> {
    if (this.draining.has(entryId)) return;
    this.draining.add(entryId);
    try {
      for (;;) {
        const row = await this.prisma.photoEntryPublication.findFirst({
          where: { photoEntryId: entryId, status: PublicationStatus.PENDING },
          orderBy: [{ queuePosition: 'asc' }, { createdAt: 'asc' }],
        });
        if (!row) break;
        await this.processRow(row);
      }
    } finally {
      this.draining.delete(entryId);
    }
  }

  private async processRow(row: PhotoEntryPublication): Promise<void> {
    try {
      const entry = await this.prisma.photoEntry.findUniqueOrThrow({
        where: { id: row.photoEntryId },
      });
      const file = await this.resolveFile(entry, encodeKey(row.relativePath));
      const original = await readFile(file.absolutePath);
      const buffer = needsConversion(file.kind.format as ExportFormat)
        ? await toJpeg(original)
        : original;
      const upload = {
        buffer,
        originalname: basename(file.relativePath),
        mimetype: 'image/jpeg',
        size: buffer.length,
      } as Express.Multer.File;

      // A re-export replaces the original in place: same Image id, so the
      // photo keeps its gallery position, hero slot and cover role (D1, Q4).
      const imageId =
        row.imageId && (await this.imageExists(row.imageId))
          ? (await this.files.replaceOriginal(row.imageId, upload)).id
          : (
              await this.files.uploadImage(
                upload,
                ImageScope.GALLERY,
                row.requestedById,
              )
            ).id;

      if (row.galleryId) await this.appendToGallery(row.galleryId, imageId);

      await this.prisma.photoEntryPublication.update({
        where: { id: row.id },
        data: {
          status: PublicationStatus.PUBLISHED,
          imageId,
          sourceSize: BigInt(file.size),
          sourceMtime: file.mtime,
          publishedAt: new Date(),
          error: null,
        },
      });
    } catch (err) {
      const message = (err as Error).message ?? String(err);
      this.logger.warn(`Publishing ${row.relativePath} failed: ${message}`);
      await this.prisma.photoEntryPublication.update({
        where: { id: row.id },
        data: {
          status: PublicationStatus.FAILED,
          error: message.slice(0, 500),
        },
      });
    }
  }

  // ------------------------------------------------------------ helpers

  /**
   * The single way from a key to a file (Q2): decode, rebuild the path under
   * the export folder, then realpath it and check it is still inside — no
   * `..`, no symlink pointing out.
   */
  private async resolveFile(
    entry: PhotoEntry,
    key: string,
  ): Promise<ResolvedFile> {
    const relativePath = decodeKey(key);
    if (!relativePath) throw new BadRequestException('Invalid file key');

    const folder = exportFolderOf(entry);
    const root = this.storage.buildAbsolutePath(`${entry.rootPath}/${folder}`);
    const candidate = this.storage.buildAbsolutePath(
      `${entry.rootPath}/${folder}/${relativePath}`,
    );
    const [realRoot, realFile] = await Promise.all([
      realpath(root).catch(() => null),
      realpath(candidate).catch(() => null),
    ]);
    if (!realRoot || !realFile || !isInside(realRoot, realFile)) {
      throw new NotFoundException('File is not in the export folder');
    }
    const info = await stat(realFile);
    const kind = classifyExportFile(basename(relativePath));
    if (!info.isFile() || !kind) {
      throw new NotFoundException('File is not in the export folder');
    }
    return {
      relativePath,
      absolutePath: realFile,
      size: info.size,
      mtime: info.mtime,
      kind,
    };
  }

  private toFileResponse(
    entryId: string,
    secret: string,
    exp: number,
    file: ResolvedFile,
    dims: { width: number; height: number } | null,
    row: PhotoEntryPublication | null,
  ): ExportFileResponse {
    const key = encodeKey(file.relativePath);
    const version = fileVersion(file.size, file.mtime.getTime());
    const url = (size: PreviewSize) =>
      file.kind.publishable
        ? previewUrl(secret, entryId, key, size, exp, version)
        : null;
    return {
      key,
      name: basename(file.relativePath),
      relativePath: file.relativePath,
      size: file.size,
      modifiedAt: file.mtime,
      width: dims?.width ?? null,
      height: dims?.height ?? null,
      format: file.kind.format ?? 'unknown',
      publishable: file.kind.publishable,
      reason: file.kind.reason,
      status: exportFileStatus(row, file),
      publication: row
        ? {
            imageId: row.imageId,
            galleryId: row.galleryId,
            publishedAt: row.publishedAt,
            error: row.error,
          }
        : null,
      thumbUrl: url(PreviewSize.THUMB),
      previewUrl: url(PreviewSize.PREVIEW),
    };
  }

  private async getOwnedEntry(
    userId: string,
    entryId: string,
  ): Promise<PhotoEntry> {
    const entry = await this.prisma.photoEntry.findFirst({
      where: { id: entryId, userId },
    });
    if (!entry) throw new NotFoundException('PhotoEntry not found');
    exportFolderOf(entry); // throws for unsupported entries
    return entry;
  }

  private async existingGallery(galleryId: string): Promise<string> {
    const gallery = await this.prisma.gallery.findUnique({
      where: { id: galleryId },
      select: { id: true },
    });
    if (!gallery) throw new NotFoundException('Gallery not found');
    return gallery.id;
  }

  private async imageExists(imageId: string): Promise<boolean> {
    return (await this.prisma.image.count({ where: { id: imageId } })) === 1;
  }

  /** Appends at the end; a photo already in the gallery stays where it is. */
  private async appendToGallery(
    galleryId: string,
    imageId: string,
  ): Promise<void> {
    const existing = await this.prisma.galleryImage.findUnique({
      where: { galleryId_imageId: { galleryId, imageId } },
      select: { id: true },
    });
    if (existing) return;
    const last = await this.prisma.galleryImage.findFirst({
      where: { galleryId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    await this.prisma.galleryImage.create({
      data: { galleryId, imageId, order: (last?.order ?? -1) + 1 },
    });
  }

  private requireSecret(): string {
    if (!this.secret) {
      throw new BadRequestException(
        'JWT_SECRET is not configured — previews cannot be signed',
      );
    }
    return this.secret;
  }
}

/** The export folder of an entry, or a 400 explaining why there is none. */
export const exportFolderOf = (
  entry: Pick<PhotoEntry, 'type' | 'foldersCreated' | 'rootPath'>,
): string => {
  const structure = STRUCTURE[entry.type];
  if (!structure) {
    throw new BadRequestException(
      'ASTRO entries keep exports per astro object — publishing them is not supported yet',
    );
  }
  if (!entry.foldersCreated || !entry.rootPath) {
    throw new BadRequestException(
      'The entry folders have not been created yet',
    );
  }
  return ENTRY_STRUCTURES[structure].find(
    (f) => f.role === PhotoEntryFolderRole.EXPORT,
  )!.path;
};

/** Header-only read; width/height as displayed (EXIF orientation applied). */
const dimensionsOf = async (path: string) => {
  try {
    const m = await sharp(path).metadata();
    if (!m.width || !m.height) return null;
    const rotated = (m.orientation ?? 1) >= 5;
    return rotated
      ? { width: m.height, height: m.width }
      : { width: m.width, height: m.height };
  } catch {
    return null;
  }
};

/**
 * D3 — non-JPEG exports become a high-quality JPEG, metadata kept. JPEG has no
 * alpha channel: a transparent PNG is flattened onto white, or its transparent
 * areas would turn black.
 */
export const toJpeg = (input: Buffer): Promise<Buffer> =>
  sharp(input, { failOn: 'none' })
    .flatten({ background: '#ffffff' })
    .withMetadata()
    .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
    .toBuffer();

async function mapLimited<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return out;
}
