import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  Location,
  PhotoEntry,
  PhotoEntryCountsSource,
  PhotoEntryStatus,
  PhotoEntryType,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  ENTRY_STRUCTURES,
  EntryStructureType,
  PhotoEntryFolderRole,
} from '../../photo-storage-service/entry-structure';
import {
  FolderListing,
  PhotoStorageService,
} from '../../photo-storage-service/photo-storage.service';
import { PhotoEntryMapper } from '../mappers';
import { PhotoEntryResponse } from '../responses';
import {
  countEditedFrames,
  countFrames,
  isIgnoredDir,
  ProgressCounts,
  reconcileCounts,
  sameCounts,
  scanMayOverwrite,
} from './folder-counts';

/** Entry types with a single root holding SOURCE / SELECTS / EXPORT. */
const SCANNABLE: Partial<Record<PhotoEntryType, EntryStructureType>> = {
  [PhotoEntryType.GENERAL]: 'general',
  [PhotoEntryType.WORK]: 'work',
};

export interface ScanResult {
  counts: ProgressCounts;
  /** When the scanned folders last gained, lost or renamed a file. */
  foldersChangedAt: Date | null;
}

/**
 * Progress counts counted from the entry folders (§7, phase 6). Runs:
 *  - on demand (`refresh`) — the user asked, so it always applies;
 *  - after `mark-media-uploaded` — the uploader has just copied the source;
 *  - nightly — off-hours, so it does not keep waking the NAS disks.
 * The automatic runs never overwrite counts reported after the folders last
 * changed (`scanMayOverwrite`), so the culling app keeps the last word until
 * the files actually move.
 */
@Injectable()
export class PhotoEntryCountsService {
  private readonly logger = new Logger(PhotoEntryCountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: PhotoStorageService,
  ) {}

  /** Explicit refresh: applies whatever the folders say. */
  async refresh(userId: string, entryId: string): Promise<PhotoEntryResponse> {
    const entry = await this.prisma.photoEntry.findFirst({
      where: { id: entryId, userId },
    });
    if (!entry) throw new NotFoundException('PhotoEntry not found');

    const reason = unscannableReason(entry);
    if (reason) throw new BadRequestException(reason);

    const { counts } = await this.scan(entry);
    return PhotoEntryMapper.toResponse(await this.apply(entry.id, counts));
  }

  /**
   * Automatic refresh: quiet (never throws — a missing mount must not fail
   * the caller) and respectful of newer reported counts. Returns the updated
   * entry, or null when nothing was written.
   */
  async refreshAutomatically(
    entryId: string,
  ): Promise<(PhotoEntry & { location: Location | null }) | null> {
    try {
      const entry = await this.prisma.photoEntry.findUnique({
        where: { id: entryId },
      });
      if (!entry || unscannableReason(entry)) return null;

      const { counts, foldersChangedAt } = await this.scan(entry);
      if (sameCounts(entry, counts)) return null;
      if (!scanMayOverwrite(entry, foldersChangedAt)) return null;

      return await this.apply(entry.id, counts);
    } catch (err) {
      this.logger.warn(
        `Counting folders of entry ${entryId} failed: ${(err as Error).message}`,
      );
      return null;
    }
  }

  @Cron('0 4 * * *')
  async runNightly(): Promise<void> {
    const entries = await this.prisma.photoEntry.findMany({
      where: {
        status: PhotoEntryStatus.SHOT,
        foldersCreated: true,
        rootPath: { not: null },
        type: { in: [PhotoEntryType.GENERAL, PhotoEntryType.WORK] },
      },
      select: { id: true },
    });

    // Sequential on purpose: one entry at a time is gentle on a NAS.
    let changed = 0;
    for (const { id } of entries) {
      if (await this.refreshAutomatically(id)) changed++;
    }
    this.logger.log(
      `Nightly folder count: ${entries.length} entries scanned, ${changed} updated`,
    );
  }

  /** Reads the counts off the disk without storing anything. */
  async scan(
    entry: Pick<PhotoEntry, 'type' | 'rootPath'>,
  ): Promise<ScanResult> {
    const structure = ENTRY_STRUCTURES[SCANNABLE[entry.type]!];
    const pathOf = (role: PhotoEntryFolderRole) =>
      structure.find((f) => f.role === role)?.path;
    const under = (parent: string, role: PhotoEntryFolderRole) => {
      const path = pathOf(role);
      return path?.startsWith(`${parent}/`)
        ? path.slice(parent.length + 1)
        : undefined;
    };

    const source = pathOf(PhotoEntryFolderRole.SOURCE)!;
    // Video and timelapse sequences are not "photos to go through": a single
    // timelapse would dwarf the shoot's real frame count.
    const excluded = new Set(
      [PhotoEntryFolderRole.SOURCE_VIDEO, PhotoEntryFolderRole.SOURCE_SEQUENCES]
        .map((role) => under(source, role))
        .filter((p): p is string => !!p),
    );
    // RAW/ and JPEG/ are two renderings of the same frames.
    const renderings = [
      PhotoEntryFolderRole.SOURCE_RAW,
      PhotoEntryFolderRole.SOURCE_JPEG,
    ]
      .map((role) => under(source, role))
      .filter((p): p is string => !!p);

    const list = (
      relative: string | undefined,
      skipPaths = new Set<string>(),
    ) =>
      relative
        ? this.storage.listFiles(
            `${entry.rootPath}/${relative}`,
            (dir, name) => isIgnoredDir(name) || skipPaths.has(dir),
          )
        : Promise.resolve(null);

    const [sourceList, selectsList, exportList] = await Promise.all([
      list(source, excluded),
      list(pathOf(PhotoEntryFolderRole.SELECTS)),
      list(pathOf(PhotoEntryFolderRole.EXPORT)),
    ]);

    const selectedCount = countFrames(selectsList?.files ?? null);
    const counts = reconcileCounts({
      photoCount: countFrames(sourceList?.files ?? null, renderings),
      selectedCount,
      // Matched against the selection, or the source when nothing was selected.
      editedCount: countEditedFrames(
        exportList?.files ?? null,
        selectedCount ? selectsList!.files : (sourceList?.files ?? null),
      ),
    });

    return {
      counts,
      foldersChangedAt: latest(sourceList, selectsList, exportList),
    };
  }

  private apply(entryId: string, counts: ProgressCounts) {
    return this.prisma.photoEntry.update({
      where: { id: entryId },
      include: { location: true },
      data: {
        ...counts,
        countsSource: PhotoEntryCountsSource.SCANNED,
        countsUpdatedAt: new Date(),
      },
    });
  }
}

/** Why an entry cannot be counted from disk, or null when it can. */
export const unscannableReason = (
  entry: Pick<PhotoEntry, 'type' | 'foldersCreated' | 'rootPath'>,
): string | null => {
  if (!SCANNABLE[entry.type]) {
    return 'ASTRO entries are filed per astro object and have no single folder to count';
  }
  if (!entry.foldersCreated || !entry.rootPath) {
    return 'The entry folders have not been created yet';
  }
  return null;
};

const latest = (...listings: Array<FolderListing | null>): Date | null =>
  listings.reduce<Date | null>(
    (max, l) => (l && (!max || l.changedAt > max) ? l.changedAt : max),
    null,
  );
