import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  Project,
  ProjectRole,
  ProjectType,
  StatusCategory,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import {
  AddProjectMemberDto,
  CreateProjectDto,
  CreateProjectStatusDto,
  ListProjectsQueryDto,
  UpdateProjectDto,
  UpdateProjectStatusDto,
} from './dto';
import { ProjectAccess, ProjectAccessService } from './project-access.service';
import {
  DEFAULT_STATUSES,
  INBOX_KEY,
  deriveProjectKey,
} from './project-defaults';
import { ProjectEventsService } from './project-events.service';
import {
  ProjectDetailResponse,
  ProjectMemberResponse,
  ProjectProgressResponse,
  ProjectStatusResponse,
  ProjectSummaryResponse,
} from './responses';

export const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
} satisfies Prisma.UserSelect;

const nullableDate = (value?: string | null) =>
  value === undefined ? undefined : value === null ? null : new Date(value);

/**
 * Projects, their workflows and their members (docs/projects-design.md).
 * Every call goes through ProjectAccessService (I1).
 */
@Injectable()
export class ProjectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly events: ProjectEventsService,
  ) {}

  // — projects —

  async list(
    userId: string,
    query: ListProjectsQueryDto,
  ): Promise<ProjectSummaryResponse[]> {
    await this.ensureInbox(userId);

    const term = query.q?.trim();
    const projects = await this.prisma.project.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
        isTemplate: false,
        archivedAt: query.archived ? { not: null } : null,
        ...(query.status ? { status: query.status } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(term
          ? {
              AND: [
                {
                  OR: [
                    { title: { contains: term, mode: 'insensitive' } },
                    { key: { contains: term.toUpperCase() } },
                  ],
                },
              ],
            }
          : {}),
      },
      include: this.summaryInclude(userId),
      orderBy: [{ isInbox: 'desc' }, { updatedAt: 'desc' }],
    });

    const progress = await this.progressFor(projects.map((p) => p.id));
    return projects.map((p) => this.toSummary(p, userId, progress.get(p.id)));
  }

  async get(userId: string, projectId: string): Promise<ProjectDetailResponse> {
    await this.access.assert(userId, projectId, ProjectAccess.VIEW);
    return this.detail(userId, projectId);
  }

  /** The personal inbox, created on first use: one per account. */
  async inbox(userId: string): Promise<ProjectDetailResponse> {
    const inbox = await this.ensureInbox(userId);
    return this.detail(userId, inbox.id);
  }

  async create(
    userId: string,
    dto: CreateProjectDto,
  ): Promise<ProjectDetailResponse> {
    const type = dto.type ?? ProjectType.GENERAL;
    const key = await this.resolveKey(userId, dto.title, dto.key);

    const project = await this.prisma.project.create({
      data: {
        title: dto.title.trim(),
        description: dto.description ?? null,
        type,
        status: dto.status,
        key,
        startDate: nullableDate(dto.startDate),
        dueDate: nullableDate(dto.dueDate),
        color: dto.color ?? null,
        icon: dto.icon ?? null,
        viewersCanCheck: dto.viewersCanCheck ?? type === ProjectType.LIST,
        ownerId: userId,
        statuses: {
          create: DEFAULT_STATUSES[type].map((status, order) => ({
            ...status,
            order,
          })),
        },
      },
    });

    return this.detail(userId, project.id);
  }

  async update(
    userId: string,
    projectId: string,
    dto: UpdateProjectDto,
  ): Promise<ProjectDetailResponse> {
    const ownerOnly = dto.key !== undefined || dto.archived !== undefined;
    const { project } = await this.access.assert(
      userId,
      projectId,
      ownerOnly ? ProjectAccess.OWN : ProjectAccess.EDIT,
    );

    if (project.isInbox && (dto.key || dto.type || dto.archived)) {
      throw new BadRequestException(
        'The inbox keeps its key and type, and cannot be archived.',
      );
    }

    let key: string | undefined;
    if (dto.key && dto.key !== project.key) {
      key = await this.resolveKey(project.ownerId, project.title, dto.key);
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        title: dto.title?.trim(),
        description: dto.description,
        type: dto.type,
        status: dto.status,
        key,
        startDate: nullableDate(dto.startDate),
        dueDate: nullableDate(dto.dueDate),
        color: dto.color,
        icon: dto.icon,
        viewersCanCheck: dto.viewersCanCheck,
        archivedAt:
          dto.archived === undefined
            ? undefined
            : dto.archived
              ? new Date()
              : null,
      },
    });

    void this.events.changed({ projectId, kind: 'project', actorId: userId });
    return this.detail(userId, projectId);
  }

  async remove(userId: string, projectId: string): Promise<void> {
    const { project } = await this.access.assert(
      userId,
      projectId,
      ProjectAccess.OWN,
    );
    if (project.isInbox) {
      throw new BadRequestException('The inbox cannot be deleted.');
    }

    const audience = await this.access.audience(projectId);
    await this.prisma.project.delete({ where: { id: projectId } });
    void this.events.changed(
      { projectId, kind: 'project', actorId: userId },
      audience,
    );
  }

  // — workflow statuses (D13) —

  async createStatus(
    userId: string,
    projectId: string,
    dto: CreateProjectStatusDto,
  ): Promise<ProjectStatusResponse[]> {
    await this.access.assert(userId, projectId, ProjectAccess.EDIT);

    const last = await this.prisma.projectTaskStatus.findFirst({
      where: { projectId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    await this.prisma.projectTaskStatus
      .create({
        data: {
          projectId,
          name: dto.name.trim(),
          category: dto.category,
          color: dto.color ?? null,
          order: (last?.order ?? -1) + 1,
        },
      })
      .catch((error) => this.rethrowDuplicateName(error, dto.name));

    return this.statusesChanged(userId, projectId);
  }

  async updateStatus(
    userId: string,
    projectId: string,
    statusId: string,
    dto: UpdateProjectStatusDto,
  ): Promise<ProjectStatusResponse[]> {
    await this.access.assert(userId, projectId, ProjectAccess.EDIT);
    const status = await this.statusOf(projectId, statusId);

    if (dto.category && dto.category !== status.category) {
      await this.assertWorkflowKeeps(projectId, statusId, dto.category);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.projectTaskStatus
        .update({
          where: { id: statusId },
          data: {
            name: dto.name?.trim(),
            category: dto.category,
            color: dto.color,
          },
        })
        .catch((error) => this.rethrowDuplicateName(error, dto.name ?? ''));

      // A status that now means "done" (or no longer does) completes or
      // reopens its tasks, so completedAt keeps following the category (I8).
      if (dto.category && dto.category !== status.category) {
        const nowDone = dto.category === StatusCategory.DONE;
        if (nowDone || status.category === StatusCategory.DONE) {
          await tx.task.updateMany({
            where: { statusId },
            data: nowDone
              ? { completedAt: new Date() }
              : { completedAt: null, completedById: null },
          });
        }
      }
    });

    return this.statusesChanged(userId, projectId);
  }

  async reorderStatuses(
    userId: string,
    projectId: string,
    ids: string[],
  ): Promise<ProjectStatusResponse[]> {
    await this.access.assert(userId, projectId, ProjectAccess.EDIT);

    const statuses = await this.prisma.projectTaskStatus.findMany({
      where: { projectId },
      select: { id: true },
    });
    const known = new Set(statuses.map((s) => s.id));
    if (ids.length !== known.size || !ids.every((id) => known.has(id))) {
      throw new BadRequestException(
        'Send every status of the project exactly once.',
      );
    }

    await this.prisma.$transaction(
      ids.map((id, order) =>
        this.prisma.projectTaskStatus.update({
          where: { id },
          data: { order },
        }),
      ),
    );
    return this.statusesChanged(userId, projectId);
  }

  /** Its tasks move to another status first: a task always has one. */
  async removeStatus(
    userId: string,
    projectId: string,
    statusId: string,
    moveToStatusId: string,
  ): Promise<ProjectStatusResponse[]> {
    await this.access.assert(userId, projectId, ProjectAccess.EDIT);
    const status = await this.statusOf(projectId, statusId);
    const target = await this.statusOf(projectId, moveToStatusId);
    if (target.id === status.id) {
      throw new BadRequestException('Move the tasks to a different status.');
    }
    await this.assertWorkflowKeeps(projectId, statusId, null);

    const enteringDone =
      target.category === StatusCategory.DONE &&
      status.category !== StatusCategory.DONE;
    const leavingDone =
      status.category === StatusCategory.DONE &&
      target.category !== StatusCategory.DONE;

    await this.prisma.$transaction(async (tx) => {
      const last = await tx.task.findFirst({
        where: { statusId: target.id },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      const moving = await tx.task.findMany({
        where: { statusId },
        orderBy: { order: 'asc' },
        select: { id: true },
      });
      let order = (last?.order ?? -1) + 1;
      for (const task of moving) {
        await tx.task.update({
          where: { id: task.id },
          data: {
            statusId: target.id,
            order: order++,
            ...(enteringDone ? { completedAt: new Date() } : {}),
            ...(leavingDone ? { completedAt: null, completedById: null } : {}),
          },
        });
      }
      await tx.projectTaskStatus.delete({ where: { id: statusId } });
    });

    return this.statusesChanged(userId, projectId);
  }

  // — members (D1, D2, D4) —

  async listMembers(
    userId: string,
    projectId: string,
  ): Promise<ProjectMemberResponse[]> {
    await this.access.assert(userId, projectId, ProjectAccess.VIEW);
    return this.members(projectId);
  }

  async addMember(
    userId: string,
    projectId: string,
    dto: AddProjectMemberDto,
  ): Promise<ProjectMemberResponse[]> {
    const { project } = await this.access.assert(
      userId,
      projectId,
      ProjectAccess.OWN,
    );
    if (project.isInbox) {
      throw new BadRequestException(
        'The inbox is personal and cannot be shared.',
      );
    }
    this.assertMemberRole(dto.role);

    // Exact match only: this must not become a way to browse accounts.
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: dto.email.trim(), mode: 'insensitive' } },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('No account can be added with this e-mail.');
    }
    if (user.id === project.ownerId) {
      throw new ConflictException('The owner is already in the project.');
    }

    await this.prisma.projectMember
      .create({
        data: {
          projectId,
          userId: user.id,
          role: dto.role,
          invitedById: userId,
        },
      })
      .catch((error) => {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException('This account is already a member.');
        }
        throw error;
      });

    void this.events.changed({ projectId, kind: 'member', actorId: userId });
    return this.members(projectId);
  }

  async updateMember(
    userId: string,
    projectId: string,
    memberId: string,
    role: ProjectRole,
  ): Promise<ProjectMemberResponse[]> {
    await this.access.assert(userId, projectId, ProjectAccess.OWN);
    this.assertMemberRole(role);

    await this.prisma.projectMember
      .update({
        where: { projectId_userId: { projectId, userId: memberId } },
        data: { role },
      })
      .catch(() => {
        throw new NotFoundException('Member not found');
      });

    void this.events.changed({ projectId, kind: 'member', actorId: userId });
    return this.members(projectId);
  }

  /** The owner removes anyone; a member can remove only themselves (leave). */
  async removeMember(
    userId: string,
    projectId: string,
    memberId: string,
  ): Promise<void> {
    await this.access.assert(
      userId,
      projectId,
      memberId === userId ? ProjectAccess.VIEW : ProjectAccess.OWN,
    );

    const removed = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.projectMember.deleteMany({
        where: { projectId, userId: memberId },
      });
      if (count) {
        // Their tasks stay; nobody is assigned to them any more.
        await tx.task.updateMany({
          where: { projectId, assigneeId: memberId },
          data: { assigneeId: null },
        });
      }
      return count;
    });
    if (!removed) throw new NotFoundException('Member not found');

    void this.events.changed({ projectId, kind: 'member', actorId: userId }, [
      memberId,
    ]);
  }

  // — internals —

  async ensureInbox(userId: string): Promise<Project> {
    const existing = await this.prisma.project.findFirst({
      where: { ownerId: userId, isInbox: true },
    });
    if (existing) return existing;

    return this.prisma.project
      .create({
        data: {
          title: 'Inbox',
          key: INBOX_KEY,
          isInbox: true,
          status: 'ACTIVE',
          ownerId: userId,
          statuses: {
            create: DEFAULT_STATUSES.GENERAL.map((status, order) => ({
              ...status,
              order,
            })),
          },
        },
      })
      .catch(async (error) => {
        // Two first requests at once: the other one created it.
        const inbox = await this.prisma.project.findFirst({
          where: { ownerId: userId, isInbox: true },
        });
        if (inbox) return inbox;
        throw error;
      });
  }

  private async resolveKey(
    ownerId: string,
    title: string,
    requested?: string,
  ): Promise<string> {
    const taken = new Set(
      (
        await this.prisma.project.findMany({
          where: { ownerId },
          select: { key: true },
        })
      ).map((p) => p.key),
    );

    if (requested) {
      if (requested === INBOX_KEY || taken.has(requested)) {
        throw new ConflictException(`The key ${requested} is already used.`);
      }
      return requested;
    }
    return deriveProjectKey(title, taken);
  }

  private async detail(
    userId: string,
    projectId: string,
  ): Promise<ProjectDetailResponse> {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: this.summaryInclude(userId),
    });
    const progress = await this.progressFor([projectId]);

    return {
      ...this.toSummary(project, userId, progress.get(projectId)),
      statuses: await this.statuses(projectId),
      members: await this.members(projectId),
    };
  }

  private summaryInclude(userId: string) {
    return {
      owner: { select: USER_SELECT },
      members: { where: { userId }, select: { role: true } },
      _count: { select: { members: true } },
    } satisfies Prisma.ProjectInclude;
  }

  private toSummary(
    project: Project & {
      owner: ProjectSummaryResponse['owner'];
      members: { role: ProjectRole }[];
      _count: { members: number };
    },
    userId: string,
    progress?: ProjectProgressResponse,
  ): ProjectSummaryResponse {
    return {
      id: project.id,
      title: project.title,
      description: project.description,
      type: project.type,
      status: project.status,
      key: project.key,
      startDate: project.startDate,
      dueDate: project.dueDate,
      color: project.color,
      icon: project.icon,
      isInbox: project.isInbox,
      isTemplate: project.isTemplate,
      viewersCanCheck: project.viewersCanCheck,
      archivedAt: project.archivedAt,
      role:
        project.ownerId === userId
          ? ProjectRole.OWNER
          : (project.members[0]?.role ?? ProjectRole.VIEWER),
      owner: project.owner,
      memberCount: project._count.members,
      progress: progress ?? emptyProgress(),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  /** Counted from the tasks, per category — never stored (I5). */
  private async progressFor(
    projectIds: string[],
  ): Promise<Map<string, ProjectProgressResponse>> {
    const result = new Map<string, ProjectProgressResponse>();
    if (!projectIds.length) return result;

    const [byStatus, overdue, statuses] = await Promise.all([
      this.prisma.task.groupBy({
        by: ['projectId', 'statusId'],
        where: { projectId: { in: projectIds }, parentTaskId: null },
        _count: { _all: true },
      }),
      this.prisma.task.groupBy({
        by: ['projectId'],
        where: {
          projectId: { in: projectIds },
          parentTaskId: null,
          dueDate: { lt: new Date() },
          status: { category: { not: StatusCategory.DONE } },
        },
        _count: { _all: true },
      }),
      this.prisma.projectTaskStatus.findMany({
        where: { projectId: { in: projectIds } },
        select: { id: true, category: true },
      }),
    ]);

    const category = new Map(statuses.map((s) => [s.id, s.category]));
    for (const id of projectIds) result.set(id, emptyProgress());

    for (const row of byStatus) {
      const p = result.get(row.projectId)!;
      const n = row._count._all;
      p.total += n;
      const c = category.get(row.statusId);
      if (c === StatusCategory.DONE) p.done += n;
      else if (c === StatusCategory.IN_PROGRESS) p.inProgress += n;
      else p.todo += n;
    }
    for (const row of overdue) {
      result.get(row.projectId)!.overdue = row._count._all;
    }
    return result;
  }

  private async statuses(projectId: string): Promise<ProjectStatusResponse[]> {
    const statuses = await this.prisma.projectTaskStatus.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
      include: {
        _count: { select: { tasks: { where: { parentTaskId: null } } } },
      },
    });
    return statuses.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      category: s.category,
      order: s.order,
      taskCount: s._count.tasks,
    }));
  }

  private async members(projectId: string): Promise<ProjectMemberResponse[]> {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: {
        createdAt: true,
        owner: { select: USER_SELECT },
        members: {
          orderBy: { createdAt: 'asc' },
          select: {
            role: true,
            createdAt: true,
            user: { select: USER_SELECT },
          },
        },
      },
    });
    return [
      {
        user: project.owner,
        role: ProjectRole.OWNER,
        createdAt: project.createdAt,
      },
      ...project.members,
    ];
  }

  private async statusesChanged(userId: string, projectId: string) {
    void this.events.changed({ projectId, kind: 'status', actorId: userId });
    return this.statuses(projectId);
  }

  private async statusOf(projectId: string, statusId: string) {
    const status = await this.prisma.projectTaskStatus.findFirst({
      where: { id: statusId, projectId },
    });
    if (!status) throw new NotFoundException('Status not found');
    return status;
  }

  /**
   * I8: a project always keeps a to-do and a done status, or tasks could not
   * be created or completed.
   */
  private async assertWorkflowKeeps(
    projectId: string,
    changedId: string,
    newCategory: StatusCategory | null,
  ): Promise<void> {
    const statuses = await this.prisma.projectTaskStatus.findMany({
      where: { projectId },
      select: { id: true, category: true },
    });
    const after = statuses
      .map((s) => (s.id === changedId ? newCategory : s.category))
      .filter((c): c is StatusCategory => c !== null);

    for (const needed of [StatusCategory.TODO, StatusCategory.DONE]) {
      if (!after.includes(needed)) {
        throw new BadRequestException(
          `The project needs at least one ${
            needed === StatusCategory.TODO ? 'to-do' : 'done'
          } status.`,
        );
      }
    }
  }

  private assertMemberRole(role: ProjectRole): void {
    if (role === ProjectRole.OWNER) {
      throw new BadRequestException(
        'A project has one owner; add people as editors or viewers.',
      );
    }
  }

  private rethrowDuplicateName(error: unknown, name: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(`A status named "${name}" already exists.`);
    }
    throw error;
  }
}

const emptyProgress = (): ProjectProgressResponse => ({
  total: 0,
  todo: 0,
  inProgress: 0,
  done: 0,
  overdue: 0,
});
