import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ImageProcessingStatus } from '@prisma/client';
import { readFile } from 'fs/promises';

import { PrismaService } from '../prisma/prisma.service';
import { FileService } from '../file/file.service';

export type ReprocessResult = {
  id: string;
  status: ImageProcessingStatus;
};

export type BackfillResult = {
  total: number;
  done: number;
  failed: number;
};

export type ProcessingSummary = {
  total: number;
  done: number;
  pending: number;
  processing: number;
  failed: number;
};

/** 'missing' = anything not cleanly DONE; 'all' = every image; or explicit ids. */
export type ReprocessTarget = 'missing' | 'all' | string[];

const BATCH_CONCURRENCY = 3; // sharp is CPU-heavy — cap parallelism

@Injectable()
export class ImageProcessingService {
  private readonly logger = new Logger(ImageProcessingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
  ) {}

  /**
   * Rebuilds all derived data for one image from its original (idempotent).
   * Always runs — there's no version gating; calling it "re-saves from the
   * original" regardless of prior state.
   */
  async reprocess(imageId: string): Promise<ReprocessResult> {
    const image = await this.prisma.image.findUnique({
      where: { id: imageId },
      select: { id: true, originalUrl: true },
    });

    if (!image) throw new NotFoundException('Image not found');

    await this.prisma.image.update({
      where: { id: image.id },
      data: {
        processingStatus: ImageProcessingStatus.PROCESSING,
        processingError: null,
      },
    });

    try {
      const original = await readFile(image.originalUrl);
      // The SAME engine the upload path runs — stamps the row DONE.
      await this.fileService.processImage(image.id, original);
      return { id: image.id, status: ImageProcessingStatus.DONE };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`reprocess ${image.id} failed: ${message}`);

      await this.prisma.image.update({
        where: { id: image.id },
        data: {
          processingStatus: ImageProcessingStatus.FAILED,
          processingError: message,
        },
      });

      return { id: image.id, status: ImageProcessingStatus.FAILED };
    }
  }

  /**
   * Fire-and-forget backfill: resolves the target set, processes it in the
   * background (bounded concurrency) and returns immediately. Progress is
   * observable via getSummary().
   */
  async startBackfill(
    target: ReprocessTarget,
  ): Promise<{ started: true; total: number }> {
    const ids = await this.resolveTargetIds(target);

    void this.runBatch(ids).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`backfill batch crashed: ${message}`);
    });

    return { started: true, total: ids.length };
  }

  /** Synchronous batch (awaited) — used by tests / small explicit sets. */
  async runBatch(ids: string[]): Promise<BackfillResult> {
    const result: BackfillResult = { total: ids.length, done: 0, failed: 0 };

    for (let i = 0; i < ids.length; i += BATCH_CONCURRENCY) {
      const chunk = ids.slice(i, i + BATCH_CONCURRENCY);
      const outcomes = await Promise.all(chunk.map((id) => this.reprocess(id)));

      for (const outcome of outcomes) {
        if (outcome.status === ImageProcessingStatus.DONE) result.done++;
        else result.failed++;
      }
    }

    return result;
  }

  async getSummary(): Promise<ProcessingSummary> {
    const [total, done, processing, failed] = await Promise.all([
      this.prisma.image.count(),
      this.prisma.image.count({
        where: { processingStatus: ImageProcessingStatus.DONE },
      }),
      this.prisma.image.count({
        where: { processingStatus: ImageProcessingStatus.PROCESSING },
      }),
      this.prisma.image.count({
        where: { processingStatus: ImageProcessingStatus.FAILED },
      }),
    ]);

    return {
      total,
      done,
      processing,
      failed,
      pending: Math.max(total - done - processing - failed, 0),
    };
  }

  private async resolveTargetIds(target: ReprocessTarget): Promise<string[]> {
    if (Array.isArray(target)) return target;

    const where =
      target === 'all'
        ? {}
        : { processingStatus: { not: ImageProcessingStatus.DONE } };

    const rows = await this.prisma.image.findMany({
      where,
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }
}
