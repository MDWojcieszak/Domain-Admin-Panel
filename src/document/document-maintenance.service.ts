import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { readdir, rm, stat } from 'fs/promises';
import { join } from 'path';

import { PrismaService } from '../prisma/prisma.service';
import { documentIdFromFile } from './document-rules';
import { DOCUMENT_ROOT, DOCUMENT_TMP_DIR } from './document-storage';
import { DocumentService } from './document.service';

const DAY_MS = 86_400_000;

/**
 * Nightly upkeep of the document store. Files no Document row stands for
 * (an upload cut off mid-write, a crash between the file and the row) are
 * removed once a day old, so a running upload is never raced; names the
 * library did not write are never touched. PDFs still lacking a preview get
 * one, once at startup and then nightly.
 */
@Injectable()
export class DocumentMaintenanceService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DocumentMaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentService,
  ) {}

  onApplicationBootstrap(): void {
    // In the background: startup does not wait on rendering PDFs.
    void this.backfill();
  }

  @Cron('20 3 * * *')
  async nightly(): Promise<void> {
    try {
      const removed = await this.sweep();
      if (removed)
        this.logger.log(`Removed ${removed} orphaned document file(s)`);
    } catch (err) {
      this.logger.error(`Document sweep failed: ${(err as Error).message}`);
    }
    await this.backfill();
  }

  /** Returns how many files went. */
  async sweep(now: Date = new Date()): Promise<number> {
    const cutoff = now.getTime() - DAY_MS;
    let removed = 0;

    for (const folder of ['original', 'preview'] as const) {
      const dir = join(DOCUMENT_ROOT, folder);
      const names = await readdir(dir).catch(() => [] as string[]);
      const owners = new Map<string, string[]>();
      for (const name of names) {
        const id = documentIdFromFile(folder, name);
        if (id) owners.set(id, [...(owners.get(id) ?? []), name]);
      }
      if (!owners.size) continue;

      const known = new Set(
        (
          await this.prisma.document.findMany({
            where: { id: { in: [...owners.keys()] } },
            select: { id: true },
          })
        ).map((d) => d.id),
      );
      for (const [id, files] of owners) {
        if (known.has(id)) continue;
        for (const name of files) {
          removed += await this.removeIfOld(join(dir, name), cutoff);
        }
      }
    }

    // Uploads the request never finished; every file here is the library's.
    for (const name of await readdir(DOCUMENT_TMP_DIR).catch(
      () => [] as string[],
    )) {
      removed += await this.removeIfOld(join(DOCUMENT_TMP_DIR, name), cutoff);
    }
    return removed;
  }

  private async removeIfOld(path: string, cutoff: number): Promise<number> {
    const info = await stat(path).catch(() => null);
    if (!info?.isFile() || info.mtimeMs > cutoff) return 0;
    await rm(path, { force: true });
    return 1;
  }

  private async backfill(): Promise<void> {
    try {
      const done = await this.documents.backfillPdfPreviews();
      if (done) this.logger.log(`Made previews for ${done} PDF(s)`);
    } catch (err) {
      this.logger.error(
        `PDF preview backfill failed: ${(err as Error).message}`,
      );
    }
  }
}
