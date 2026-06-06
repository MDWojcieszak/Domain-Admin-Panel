import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

const CACHE_TTL_MS = 10_000;

type CacheEntry = { permissions: Set<string>; expiresAt: number };

/**
 * Resolves a user's effective permissions (union of their permission groups)
 * with a short in-memory cache. Shared by PermissionsGuard (HTTP) and the
 * WebsocketGateway (socket rooms). Does NOT handle the OWNER bypass — callers
 * check `role === OWNER` themselves (the role is in the JWT, no DB needed).
 */
@Injectable()
export class PermissionsService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

  async getEffectivePermissions(userId: string): Promise<Set<string>> {
    const cached = this.cache.get(userId);
    const now = Date.now();

    if (cached && cached.expiresAt > now) return cached.permissions;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { permissionGroups: { select: { permissions: true } } },
    });

    const permissions = new Set<string>();
    for (const group of user?.permissionGroups ?? []) {
      for (const permission of group.permissions) permissions.add(permission);
    }

    this.cache.set(userId, { permissions, expiresAt: now + CACHE_TTL_MS });
    return permissions;
  }

  invalidate(userId?: string): void {
    if (userId) this.cache.delete(userId);
    else this.cache.clear();
  }
}
