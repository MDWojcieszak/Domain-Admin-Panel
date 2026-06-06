import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { PERMISSION_CATALOG, isValidPermission } from '../common/acl/permissions';
import {
  CreatePermissionGroupDto,
  SetUserGroupsDto,
  UpdatePermissionGroupDto,
} from './dto';

@Injectable()
export class AclService {
  constructor(private readonly prisma: PrismaService) {}

  listCatalog() {
    return { permissions: PERMISSION_CATALOG };
  }

  async listGroups() {
    const groups = await this.prisma.permissionGroup.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: true } } },
    });

    return {
      groups: groups.map((group) => this.toResponse(group)),
      total: groups.length,
    };
  }

  async getGroup(id: string) {
    const group = await this.prisma.permissionGroup.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });

    if (!group) throw new NotFoundException('Permission group not found');

    return this.toResponse(group);
  }

  async createGroup(dto: CreatePermissionGroupDto) {
    this.assertValidPermissions(dto.permissions);

    const group = await this.prisma.permissionGroup.create({
      data: {
        name: dto.name,
        description: dto.description,
        permissions: this.dedupe(dto.permissions),
      },
      include: { _count: { select: { users: true } } },
    });

    return this.toResponse(group);
  }

  async updateGroup(id: string, dto: UpdatePermissionGroupDto) {
    await this.getGroup(id);

    if (dto.permissions) this.assertValidPermissions(dto.permissions);

    const group = await this.prisma.permissionGroup.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        permissions: dto.permissions
          ? this.dedupe(dto.permissions)
          : undefined,
      },
      include: { _count: { select: { users: true } } },
    });

    return this.toResponse(group);
  }

  async deleteGroup(id: string) {
    await this.getGroup(id);
    await this.prisma.permissionGroup.delete({ where: { id } });
    return { success: true };
  }

  async getUserGroups(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        permissionGroups: {
          orderBy: { name: 'asc' },
          include: { _count: { select: { users: true } } },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    return {
      groups: user.permissionGroups.map((group) => this.toResponse(group)),
      total: user.permissionGroups.length,
    };
  }

  async setUserGroups(userId: string, dto: SetUserGroupsDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const uniqueIds = this.dedupe(dto.groupIds);

    if (uniqueIds.length > 0) {
      const found = await this.prisma.permissionGroup.count({
        where: { id: { in: uniqueIds } },
      });
      if (found !== uniqueIds.length) {
        throw new BadRequestException('One or more groups were not found');
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        permissionGroups: { set: uniqueIds.map((id) => ({ id })) },
      },
    });

    return this.getUserGroups(userId);
  }

  private assertValidPermissions(permissions: string[]): void {
    const invalid = permissions.filter(
      (permission) => !isValidPermission(permission),
    );
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Unknown permissions: ${invalid.join(', ')}`,
      );
    }
  }

  private dedupe(values: string[]): string[] {
    return Array.from(new Set(values));
  }

  private toResponse(group: {
    id: string;
    name: string;
    description: string | null;
    permissions: string[];
    createdAt: Date;
    updatedAt: Date;
    _count?: { users: number };
  }) {
    return {
      id: group.id,
      name: group.name,
      description: group.description ?? undefined,
      permissions: group.permissions,
      userCount: group._count?.users,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    };
  }
}
