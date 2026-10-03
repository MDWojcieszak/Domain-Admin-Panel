import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { toLocationResponse } from '../location/entry-location';
import { PhotoEntrySkyResponse } from './responses';
import { skyReport } from './sky';

/** Sky table of an entry (§4) — computed on read, never stored (Q6). */
@Injectable()
export class SkyService {
  constructor(private readonly prisma: PrismaService) {}

  async forEntry(
    userId: string,
    entryId: string,
  ): Promise<PhotoEntrySkyResponse> {
    const entry = await this.prisma.photoEntry.findFirst({
      where: { id: entryId, userId },
      include: { location: true },
    });
    if (!entry) throw new NotFoundException('PhotoEntry not found');

    const location = toLocationResponse(entry.location);
    if (!location) {
      throw new BadRequestException('Set the entry location to see the sky');
    }
    if (!entry.startDate) {
      throw new BadRequestException('Set the entry start date to see the sky');
    }

    const report = skyReport({
      latitude: location.latitude,
      longitude: location.longitude,
      timezone: location.timezone,
      start: entry.startDate,
      end: entry.endDate,
    });
    return { photoEntryId: entry.id, location, ...report };
  }
}
