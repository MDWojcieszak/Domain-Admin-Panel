import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Project, ProjectRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

/** What a call needs to do with a project, weakest first. */
export enum ProjectAccess {
  VIEW = 'VIEW',
  /** Tick tasks and checklist items off. */
  CHECK = 'CHECK',
  EDIT = 'EDIT',
  /** Members, deleting, the key. */
  OWN = 'OWN',
}

export interface ProjectGrant {
  project: Project;
  role: ProjectRole;
}

export const allows = (
  role: ProjectRole,
  needed: ProjectAccess,
  viewersCanCheck: boolean,
): boolean => {
  switch (needed) {
    case ProjectAccess.VIEW:
      return true;
    case ProjectAccess.CHECK:
      return role !== ProjectRole.VIEWER || viewersCanCheck;
    case ProjectAccess.EDIT:
      return role !== ProjectRole.VIEWER;
    case ProjectAccess.OWN:
      return role === ProjectRole.OWNER;
  }
};

/**
 * The only gate to anything inside a project (I1). Ownership and membership
 * are per project, not ACL: an account's OWNER role does not open another
 * account's projects.
 */
@Injectable()
export class ProjectAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assert(
    userId: string,
    projectId: string,
    needed: ProjectAccess,
  ): Promise<ProjectGrant> {
    const found = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { members: { where: { userId }, select: { role: true } } },
    });

    const role =
      found?.ownerId === userId ? ProjectRole.OWNER : found?.members[0]?.role;

    // The same answer whether it does not exist or is not yours to see.
    if (!found || !role) throw new NotFoundException('Project not found');

    if (!allows(role, needed, found.viewersCanCheck)) {
      throw new ForbiddenException(
        `Your role in this project (${role.toLowerCase()}) does not allow this.`,
      );
    }

    const { members: _members, ...project } = found;
    return { project, role };
  }

  /** Same gate, reached through one of the project's tasks. */
  async assertTask(userId: string, taskId: string, needed: ProjectAccess) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true },
    });
    if (!task) throw new NotFoundException('Task not found');

    try {
      return { ...(await this.assert(userId, task.projectId, needed)), task };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException('Task not found');
      }
      throw error;
    }
  }

  /** Everyone who may see the project: the owner and its members. */
  async audience(projectId: string): Promise<string[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true, members: { select: { userId: true } } },
    });
    if (!project) return [];
    return [project.ownerId, ...project.members.map((m) => m.userId)];
  }
}
