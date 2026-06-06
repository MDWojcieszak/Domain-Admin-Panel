import { Injectable } from '@nestjs/common';
import {
  Prisma,
  ServerProcessStatus,
  ServerTransferStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { TrendsRange } from './dto';
import {
  DashboardGalleryResponseDto,
  DashboardResponseDto,
  DashboardTrendsResponseDto,
} from './responses';

type GroupRow = Record<string, unknown> & { _count: { _all: number } };

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(): Promise<DashboardResponseDto> {
    const [
      serversTotal,
      serversOnline,
      processesTotal,
      processesByStatus,
      recentProcesses,
      usersTotal,
      photoEntriesTotal,
      photoEntriesByType,
      photoEntriesByStatus,
      transfersTotal,
      transfersByStatus,
    ] = await Promise.all([
      this.prisma.server.count({ where: { isDeleted: false } }),
      this.prisma.serverProperties.count({ where: { isOnline: true } }),
      this.prisma.process.count(),
      this.prisma.process.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.process.findMany({
        take: 5,
        orderBy: { startedAt: 'desc' },
        select: {
          id: true,
          name: true,
          status: true,
          runtimeStatus: true,
          progress: true,
          startedAt: true,
        },
      }),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.photoEntry.count(),
      this.prisma.photoEntry.groupBy({ by: ['type'], _count: { _all: true } }),
      this.prisma.photoEntry.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.serverTransfer.count(),
      this.prisma.serverTransfer.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    const processCounts = this.toMap(processesByStatus as GroupRow[], 'status');
    const transferCounts = this.toMap(
      transfersByStatus as GroupRow[],
      'status',
    );

    return {
      servers: {
        total: serversTotal,
        online: serversOnline,
        offline: Math.max(serversTotal - serversOnline, 0),
      },
      processes: {
        total: processesTotal,
        running:
          (processCounts[ServerProcessStatus.STARTED] ?? 0) +
          (processCounts[ServerProcessStatus.ONGOING] ?? 0),
        failed: processCounts[ServerProcessStatus.FAILED] ?? 0,
        recent: recentProcesses.map((process) => ({
          id: process.id,
          name: process.name,
          status: process.status,
          runtimeStatus: process.runtimeStatus,
          progress: process.progress ?? undefined,
          startedAt: process.startedAt,
        })),
      },
      users: { total: usersTotal },
      photoEntries: {
        total: photoEntriesTotal,
        byType: this.toArray(photoEntriesByType as GroupRow[], 'type'),
        byStatus: this.toArray(photoEntriesByStatus as GroupRow[], 'status'),
      },
      transfers: {
        total: transfersTotal,
        running: transferCounts[ServerTransferStatus.RUNNING] ?? 0,
        failed: transferCounts[ServerTransferStatus.FAILED] ?? 0,
      },
    };
  }

  async getGallery(): Promise<DashboardGalleryResponseDto> {
    const [
      images,
      catalogued,
      withoutAuthor,
      withoutTitle,
      withoutDescription,
      byAuthorRows,
      byLocalizationRows,
      recentRows,
    ] = await Promise.all([
      this.prisma.image.count(),
      this.prisma.imageData.count(),
      this.prisma.imageData.count({ where: { authorId: null } }),
      this.prisma.imageData.count({ where: { title: null } }),
      this.prisma.imageData.count({ where: { description: null } }),
      this.prisma.imageData.groupBy({
        by: ['authorId'],
        _count: { _all: true },
        where: { authorId: { not: null } },
        orderBy: { _count: { authorId: 'desc' } },
        take: 5,
      }),
      this.prisma.imageData.groupBy({
        by: ['localization'],
        _count: { _all: true },
        orderBy: { _count: { localization: 'desc' } },
        take: 5,
      }),
      this.prisma.imageData.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          imageId: true,
          title: true,
          dateTaken: true,
          localization: true,
          author: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    const authorIds = byAuthorRows
      .map((row) => row.authorId)
      .filter((id): id is string => Boolean(id));
    const authors = authorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: authorIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
    const nameById = new Map(
      authors.map((author) => [
        author.id,
        this.fullName(author.firstName, author.lastName) || author.id,
      ]),
    );

    return {
      totals: {
        images,
        catalogued,
        missingMetadata: Math.max(images - catalogued, 0),
      },
      completeness: { withoutAuthor, withoutTitle, withoutDescription },
      byAuthor: byAuthorRows.map((row) => ({
        authorId: row.authorId as string,
        name: nameById.get(row.authorId as string) ?? (row.authorId as string),
        count: row._count._all,
      })),
      byLocalization: byLocalizationRows.map((row) => ({
        key: row.localization,
        count: row._count._all,
      })),
      recent: recentRows.map((row) => ({
        imageId: row.imageId,
        title: row.title ?? undefined,
        dateTaken: row.dateTaken,
        localization: row.localization,
        author: row.author
          ? this.fullName(row.author.firstName, row.author.lastName) ||
            undefined
          : undefined,
      })),
    };
  }

  async getTrends(
    range: TrendsRange = TrendsRange.WEEK,
  ): Promise<DashboardTrendsResponseDto> {
    const days = range === TrendsRange.MONTH ? 30 : 7;
    const since = this.startOfDayUtc(days - 1);
    const since12mo = this.startOfMonthUtc(11);

    const [
      imagesAddedRows,
      photoEntriesRows,
      newUsersRows,
      processRows,
      takenRows,
    ] = await Promise.all([
      this.dailyCounts('ImageData', 'createdAt', since),
      this.dailyCounts('PhotoEntry', 'createdAt', since),
      this.dailyCounts('User', 'createdAt', since),
      this.prisma.$queryRaw<
        Array<{ day: Date; total: number; failed: number }>
      >(Prisma.sql`
        SELECT date_trunc('day', "startedAt") AS day,
               count(*)::int AS total,
               count(*) FILTER (WHERE status = 'FAILED')::int AS failed
        FROM "Process"
        WHERE "startedAt" >= ${since}
        GROUP BY 1
        ORDER BY 1
      `),
      this.prisma.$queryRaw<Array<{ month: Date; count: number }>>(Prisma.sql`
        SELECT date_trunc('month', "dateTaken") AS month, count(*)::int AS count
        FROM "ImageData"
        WHERE "dateTaken" >= ${since12mo}
        GROUP BY 1
        ORDER BY 1
      `),
    ]);

    const processMap = new Map(
      processRows.map((row) => [
        this.dayKey(row.day),
        { total: Number(row.total), failed: Number(row.failed) },
      ]),
    );

    return {
      range,
      series: {
        imagesAdded: this.fillDaily(imagesAddedRows, since, days),
        photosByTaken: this.fillMonthly(takenRows, since12mo, 12),
        photoEntriesCreated: this.fillDaily(photoEntriesRows, since, days),
        processes: this.eachDay(since, days).map((date) => ({
          date,
          total: processMap.get(date)?.total ?? 0,
          failed: processMap.get(date)?.failed ?? 0,
        })),
        newUsers: this.fillDaily(newUsersRows, since, days),
      },
    };
  }

  private async dailyCounts(
    table: string,
    column: string,
    since: Date,
  ): Promise<Array<{ day: Date; count: number }>> {
    return this.prisma.$queryRaw<Array<{ day: Date; count: number }>>(
      Prisma.sql`
        SELECT date_trunc('day', ${Prisma.raw(`"${column}"`)}) AS day,
               count(*)::int AS count
        FROM ${Prisma.raw(`"${table}"`)}
        WHERE ${Prisma.raw(`"${column}"`)} >= ${since}
        GROUP BY 1
        ORDER BY 1
      `,
    );
  }

  private fillDaily(
    rows: Array<{ day: Date; count: number }>,
    since: Date,
    days: number,
  ): Array<{ date: string; count: number }> {
    const map = new Map(
      rows.map((row) => [this.dayKey(row.day), Number(row.count)]),
    );
    return this.eachDay(since, days).map((date) => ({
      date,
      count: map.get(date) ?? 0,
    }));
  }

  private fillMonthly(
    rows: Array<{ month: Date; count: number }>,
    since: Date,
    months: number,
  ): Array<{ period: string; count: number }> {
    const map = new Map(
      rows.map((row) => [this.monthKey(row.month), Number(row.count)]),
    );
    return Array.from({ length: months }, (_, i) => {
      const d = new Date(since);
      d.setUTCMonth(d.getUTCMonth() + i);
      const period = this.monthKey(d);
      return { period, count: map.get(period) ?? 0 };
    });
  }

  private eachDay(since: Date, days: number): string[] {
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(since);
      d.setUTCDate(d.getUTCDate() + i);
      return this.dayKey(d);
    });
  }

  private startOfDayUtc(daysAgo: number): Date {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - daysAgo);
    return d;
  }

  private startOfMonthUtc(monthsAgo: number): Date {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - monthsAgo);
    return d;
  }

  private dayKey(date: Date): string {
    return new Date(date).toISOString().slice(0, 10);
  }

  private monthKey(date: Date): string {
    return new Date(date).toISOString().slice(0, 7);
  }

  private fullName(first?: string | null, last?: string | null): string {
    return [first, last].filter(Boolean).join(' ').trim();
  }

  private toMap(rows: GroupRow[], key: string): Record<string, number> {
    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[String(row[key])] = row._count._all;
      return acc;
    }, {});
  }

  private toArray(
    rows: GroupRow[],
    key: string,
  ): Array<{ key: string; count: number }> {
    return rows.map((row) => ({
      key: String(row[key]),
      count: row._count._all,
    }));
  }
}
