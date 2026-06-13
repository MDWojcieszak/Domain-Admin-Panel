import { Injectable } from '@nestjs/common';
import { BlogPostStatus, PoiStatus, VersionState } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { BlogCountriesResponse } from './responses';

@Injectable()
export class CountriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Countries that have published content — distinct `country` across published
   * post versions and public POIs, with per-country counts. Powers the global
   * (site-wide) country navigation.
   */
  async list(): Promise<BlogCountriesResponse> {
    const [postGroups, poiGroups] = await Promise.all([
      this.prisma.blogPostVersion.groupBy({
        by: ['country'],
        where: {
          state: VersionState.PUBLISHED,
          country: { not: null },
          post: { status: BlogPostStatus.PUBLISHED },
        },
        _count: { _all: true },
      }),
      this.prisma.poi.groupBy({
        by: ['country'],
        where: {
          status: { not: PoiStatus.PERMANENTLY_CLOSED },
          country: { not: null },
        },
        _count: { _all: true },
      }),
    ]);

    const map = new Map<
      string,
      { country: string; postCount: number; poiCount: number }
    >();
    for (const g of postGroups) {
      if (g.country) {
        map.set(g.country, {
          country: g.country,
          postCount: g._count._all,
          poiCount: 0,
        });
      }
    }
    for (const g of poiGroups) {
      if (!g.country) continue;
      const entry = map.get(g.country) ?? {
        country: g.country,
        postCount: 0,
        poiCount: 0,
      };
      entry.poiCount = g._count._all;
      map.set(g.country, entry);
    }

    const countries = [...map.values()].sort(
      (a, b) =>
        b.postCount + b.poiCount - (a.postCount + a.poiCount) ||
        a.country.localeCompare(b.country),
    );
    return { countries };
  }
}
