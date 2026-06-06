import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS_KEY } from '../decorators';

const CACHE_TTL_MS = 10_000;

type CacheEntry = { permissions: Set<string>; expiresAt: number };

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user?.sub) throw new ForbiddenException('Not authenticated');

    // OWNER is a full administrator and bypasses permission checks.
    if (user.role === Role.OWNER) return true;

    const permissions = await this.getEffectivePermissions(user.sub);
    const allowed = required.every((permission) =>
      permissions.has(permission),
    );

    if (!allowed) {
      throw new ForbiddenException('Missing required permission');
    }

    return true;
  }

  private async getEffectivePermissions(userId: string): Promise<Set<string>> {
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
}
