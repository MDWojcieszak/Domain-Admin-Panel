import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';

import { PermissionsService } from '../acl/permissions.service';
import { ALL_PERMISSIONS } from '../acl/permissions';
import { PERMISSIONS_KEY } from '../decorators';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user?.sub) throw new ForbiddenException('Not authenticated');

    const scopes: string[] | undefined = user.scopes;
    const isOwner = user.role === Role.OWNER;

    // Session (JWT): OWNER is a full administrator and bypasses the checks.
    if (!scopes) {
      if (isOwner) return true;
      return this.assertHas(
        required,
        await this.permissionsService.getEffectivePermissions(user.sub),
      );
    }

    // Integration token: access is the intersection of what the token was
    // granted and what its user actually has. The OWNER bypass is deliberately
    // NOT applied — otherwise a token scoped to `photoEntry.read` on an owner
    // account would silently be a full administrative key. Owners still need a
    // base set to intersect with, and they have no permission groups, so their
    // base is the whole catalog.
    const base = isOwner
      ? new Set<string>(ALL_PERMISSIONS)
      : await this.permissionsService.getEffectivePermissions(user.sub);

    const granted = new Set(scopes.filter((scope) => base.has(scope)));

    return this.assertHas(required, granted);
  }

  private assertHas(required: string[], granted: Set<string>): boolean {
    if (!required.every((permission) => granted.has(permission))) {
      throw new ForbiddenException('Missing required permission');
    }
    return true;
  }
}
