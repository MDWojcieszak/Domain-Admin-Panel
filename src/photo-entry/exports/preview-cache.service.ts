import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, readdir, rename, rm, stat } from 'fs/promises';
import { join } from 'path';
import * as sharp from 'sharp';

import { PREVIEW_PIXELS, PreviewSize } from './export-files';

const DEFAULT_CACHE_PATH = '/app/public/cache/export-previews';
/** Generations running at once — a scrolling grid fires dozens of requests. */
const CONCURRENCY = 3;
/** Entry ids are uuids; anything else in the root is a leftover (old layout). */
const ENTRY_DIR = /^[0-9a-f-]{36}$/i;

/**
 * Previews of export files, generated on first request and kept for good
 * (docs/photo-entry-planning-and-publish.md §2.4).
 *
 * No expiry and no size cap: previews are small, and coming back to an entry
 * a month later must not mean waiting for them again. Only what can never be
 * shown again is removed — see `prune`. One directory per entry, so that is
 * decidable without an index.
 *
 * The cache lives OUTSIDE the photo library: the backend never writes into an
 * entry's folders (Q1).
 */
@Injectable()
export class PreviewCacheService {
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
    entryId: string,
    sourcePath: string,
    cacheName: string,
    size: PreviewSize,
  ): Promise<string> {
    const target = join(this.root, entryId, cacheName);
    if (await exists(target)) return target;

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

  /** Entry ids that have a cache directory. */
  async cachedEntries(): Promise<string[]> {
    const names = await readdir(this.root).catch(() => [] as string[]);
    return names.filter((n) => ENTRY_DIR.test(n));
  }

  /**
   * Removes the entry's previews that can never be shown again: older
   * versions of re-exported files and files no longer in the export.
   * `keep` holds the cache names of every file currently in the export.
   */
  async prune(entryId: string, keep: ReadonlySet<string>): Promise<number> {
    const dir = join(this.root, entryId);
    let removed = 0;
    for (const name of await readdir(dir).catch(() => [] as string[])) {
      if (keep.has(name)) continue;
      await rm(join(dir, name), { force: true });
      removed++;
    }
    return removed;
  }

  /** Drops a whole entry directory (the entry is gone). */
  async dropEntry(entryId: string): Promise<void> {
    await rm(join(this.root, entryId), { recursive: true, force: true });
  }

  /** Removes anything in the root that is not an entry directory. */
  async dropLeftovers(): Promise<number> {
    const names = await readdir(this.root).catch(() => [] as string[]);
    const leftovers = names.filter((n) => !ENTRY_DIR.test(n));
    for (const name of leftovers) {
      await rm(join(this.root, name), { recursive: true, force: true });
    }
    return leftovers.length;
  }

  private async generate(
    sourcePath: string,
    target: string,
    size: PreviewSize,
  ): Promise<string> {
    // A second request may have finished it while this one waited its turn.
    if (await exists(target)) return target;

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
}

const exists = async (path: string): Promise<boolean> =>
  (await stat(path).catch(() => null))?.isFile() ?? false;
