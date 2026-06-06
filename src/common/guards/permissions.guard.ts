import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';

import { PermissionsService } from '../acl/permissions.service';
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

    // OWNER is a full administrator and bypasses permission checks.
    if (user.role === Role.OWNER) return true;

    const permissions = await this.permissionsService.getEffectivePermissions(
      user.sub,
    );
    const allowed = required.every((permission) =>
      permissions.has(permission),
    );

    if (!allowed) {
      throw new ForbiddenException('Missing required permission');
    }

    return true;
  }
}
