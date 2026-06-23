import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { PublicAuthorListResponse } from './responses';

@Injectable()
export class AuthorService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves bylines for a batch of user ids. Only users who are actually blog
   * authors are returned (no arbitrary user-profile lookup); missing/non-author
   * ids are silently dropped. Exposes name + avatar only — never email.
   */
  async resolvePublic(rawIds: string): Promise<PublicAuthorListResponse> {
    const ids = [
      ...new Set(
        rawIds
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ].slice(0, 100);
    if (ids.length === 0) {
      return { authors: [] };
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: ids }, blogAuthorships: { some: {} } },
      select: { id: true, firstName: true, lastName: true, avatarId: true },
    });

    return {
      authors: users.map((u) => ({
        userId: u.id,
        displayName:
          [u.firstName, u.lastName].filter(Boolean).join(' ') || null,
        avatarImageId: u.avatarId,
      })),
    };
  }
}
