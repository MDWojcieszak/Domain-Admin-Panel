import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { mkdir, readdir, rename, rm, stat, utimes } from 'fs/promises';
import { join } from 'path';
import * as sharp from 'sharp';

import { PREVIEW_PIXELS, PreviewSize } from './export-files';

const DEFAULT_CACHE_PATH = '/app/public/cache/export-previews';
/** Generations running at once — a scrolling grid fires dozens of requests. */
const CONCURRENCY = 3;
const MAX_AGE_DAYS = 30;
const MAX_BYTES = 2 * 1024 ** 3;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Previews of export files, generated on first request and cached on disk
 * (docs/photo-entry-planning-and-publish.md §2.4).
 *
 * The cache lives OUTSIDE the photo library: the backend never writes into an
 * entry's folders (Q1). A cache file's mtime is bumped on use, so cleanup can
 * drop what nobody has looked at for a month.
 */
@Injectable()
export class PreviewCacheService {
  private readonly logger = new Logger(PreviewCacheService.name);
  private readonly root: string;
  private readonly inFlight = new Map<string, Promise<string>>();
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(config: ConfigService) {
    this.root =
      config.get<string>('EXPORT_PREVIEW_CACHE_PATH') || DEFAULT_CACHE_PATH;
  }

  /** Absolute path of the cached webp, generating it when missing. */
  async get(
    sourcePath: string,
    cacheName: string,
    size: PreviewSize,
  ): Promise<string> {
    const target = join(this.root, cacheName.slice(0, 2), cacheName);
    if (await this.touchIfExists(target)) return target;

    // Two requests for the same preview share one generation.
    const pending = this.inFlight.get(target);
    if (pending) return pending;

    const job = this.limited(() => this.generate(sourcePath, target, size));
    this.inFlight.set(target, job);
    try {
      return await job;
    } finally {
      this.inFlight.delete(target);
    }
  }

  @Cron('30 4 * * *')
  async cleanup(now: number = Date.now()): Promise<void> {
    try {
      const files = await this.cacheFiles();
      let removed = 0;
      // Oldest first, so the size cap drops the least recently used.
      files.sort((a, b) => a.mtimeMs - b.mtimeMs);
      let total = files.reduce((s, f) => s + f.size, 0);
      for (const f of files) {
        const stale = now - f.mtimeMs > MAX_AGE_DAYS * DAY_MS;
        if (!stale && total <= MAX_BYTES) break;
        await rm(f.path, { force: true });
        total -= f.size;
        removed++;
      }
      if (removed > 0) this.logger.log(`Removed ${removed} cached preview(s)`);
    } catch (err) {
      this.logger.warn(
        `Preview cache cleanup failed: ${(err as Error).message}`,
      );
    }
  }

  private async generate(
    sourcePath: string,
    target: string,
    size: PreviewSize,
  ): Promise<string> {
    // A second request may have finished it while this one waited its turn.
    if (await this.touchIfExists(target)) return target;

    await mkdir(join(target, '..'), { recursive: true });
    const tmp = `${target}.${randomUUID()}.tmp`;
    const px = PREVIEW_PIXELS[size];
    try {
      // Resizing straight from the file lets libvips shrink-on-load: a 100 MP
      // JPEG is decoded at 1/8 scale instead of in full.
      await sharp(sourcePath, { failOn: 'none' })
        .rotate()
        .resize(px, px, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(tmp);
      await rename(tmp, target);
      return target;
    } catch (err) {
      await rm(tmp, { force: true });
      throw err;
    }
  }

  private async touchIfExists(path: string): Promise<boolean> {
    try {
      const info = await stat(path);
      // Bump at most daily: cheap LRU without a write on every request.
      if (Date.now() - info.mtimeMs > DAY_MS) {
        const now = new Date();
        await utimes(path, now, now).catch(() => undefined);
      }
      return true;
    } catch {
      return false;
    }
  }

  private async limited<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= CONCURRENCY) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      this.waiting.shift()?.();
    }
  }

  private async cacheFiles() {
    const out: Array<{ path: string; size: number; mtimeMs: number }> = [];
    let shards: string[];
    try {
      shards = await readdir(this.root);
    } catch {
      return out; // nothing cached yet
    }
    for (const shard of shards) {
      const dir = join(this.root, shard);
      for (const name of await readdir(dir).catch(() => [] as string[])) {
        const path = join(dir, name);
        const info = await stat(path).catch(() => null);
        if (info?.isFile()) {
          out.push({ path, size: info.size, mtimeMs: info.mtimeMs });
        }
      }
    }
    return out;
  }
}
