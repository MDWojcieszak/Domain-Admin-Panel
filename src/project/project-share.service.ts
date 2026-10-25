import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, ProjectShareLink, ShareLinkAccess } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import {
  ShareSessionPayload,
  shareSessionSecret,
} from '../websocket/share-session';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { CreateShareLinkDto } from './dto';
import { ProjectAccess, ProjectAccessService } from './project-access.service';
import { taskKey } from './project-defaults';
import { ProjectService, USER_SELECT } from './project.service';
import {
  CreatedShareLinkResponse,
  ShareLinkResponse,
  SharedProjectResponse,
} from './responses';
import { TaskService } from './task.service';

/** Revoked, expired and unknown links all answer the same (I3). */
const GONE = 'This link does not exist or is no longer shared.';
const PASSWORD = 'This link needs its password.';

/** How long a live session lasts before the page has to reopen the link. */
const LIVE_SESSION_SECONDS = 60 * 60;

export const hashShareToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

/** Neither revoked nor past its expiry. */
export const isLinkActive = (
  link: Pick<ProjectShareLink, 'revokedAt' | 'expiresAt'>,
  now = new Date(),
) => !link.revokedAt && (!link.expiresAt || link.expiresAt > now);

const LINK_INCLUDE = {
  createdBy: { select: USER_SELECT },
} satisfies Prisma.ProjectShareLinkInclude;

type LinkRow = Prisma.ProjectShareLinkGetPayload<{
  include: typeof LINK_INCLUDE;
}>;

/**
 * Public links to a project (D3), like Immich's: one token per person, each
 * revoked on its own. Only a hash of the token is stored; the holder of the
 * link needs no account.
 */
@Injectable()
export class ProjectShareService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly projects: ProjectService,
    private readonly tasks: TaskService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly websocket: WebsocketGateway,
  ) {}

  // — the owner's side —

  async list(userId: string, projectId: string): Promise<ShareLinkResponse[]> {
    await this.access.assert(userId, projectId, ProjectAccess.OWN);
    const links = await this.prisma.projectShareLink.findMany({
      where: { projectId },
      include: LINK_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return links.map(toLink);
  }

  async create(
    userId: string,
    projectId: string,
    dto: CreateShareLinkDto,
  ): Promise<CreatedShareLinkResponse> {
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
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt && expiresAt <= new Date()) {
      throw new BadRequestException('The link would expire before it is used.');
    }

    const token = randomBytes(24).toString('base64url');
    const link = await this.prisma.projectShareLink.create({
      data: {
        projectId,
        label: dto.label?.trim() || null,
        access: dto.access,
        tokenHash: hashShareToken(token),
        passwordHash: dto.password ? await argon2.hash(dto.password) : null,
        expiresAt,
        createdById: userId,
      },
      include: LINK_INCLUDE,
    });
    return { ...toLink(link), token };
  }

  /** Immediate: the next request with the token is refused, open pages drop. */
  async revoke(
    userId: string,
    projectId: string,
    linkId: string,
  ): Promise<ShareLinkResponse> {
    await this.access.assert(userId, projectId, ProjectAccess.OWN);
    const link = await this.prisma.projectShareLink.findFirst({
      where: { id: linkId, projectId },
    });
    if (!link) throw new NotFoundException('No such link in this project.');

    const updated = await this.prisma.projectShareLink.update({
      where: { id: linkId },
      data: { revokedAt: link.revokedAt ?? new Date() },
      include: LINK_INCLUDE,
    });
    this.websocket.disconnectShareLink(linkId);
    return toLink(updated);
  }

  // — the link holder's side —

  /** `opened` counts a visit; the page's own reloads after a change don't. */
  async view(
    token: string,
    password: string | undefined,
    opened: boolean,
  ): Promise<SharedProjectResponse> {
    const link = await this.resolve(token, password);
    if (opened) {
      await this.prisma.projectShareLink.update({
        where: { id: link.id },
        data: { lastUsedAt: new Date(), openCount: { increment: 1 } },
      });
    }
    return this.shared(link);
  }

  async toggle(
    token: string,
    password: string | undefined,
    taskId: string,
  ): Promise<SharedProjectResponse> {
    const link = await this.resolve(token, password);
    if (link.access !== ShareLinkAccess.CHECK) {
      throw new ForbiddenException('This link only shows the project.');
    }
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, projectId: link.projectId },
      select: { id: true },
    });
    if (!task) throw new NotFoundException('No such task in this project.');

    await this.tasks.applyToggle(link.projectId, task.id, null);
    await this.prisma.projectShareLink.update({
      where: { id: link.id },
      data: { lastUsedAt: new Date() },
    });
    return this.shared(link);
  }

  private async resolve(token: string, password: string | undefined) {
    const link = await this.prisma.projectShareLink.findUnique({
      where: { tokenHash: hashShareToken(token) },
    });
    if (!link || !isLinkActive(link)) throw new NotFoundException(GONE);
    if (link.passwordHash) {
      const ok =
        !!password && (await argon2.verify(link.passwordHash, password));
      if (!ok) throw new UnauthorizedException(PASSWORD);
    }
    return link;
  }

  private async shared(link: ProjectShareLink): Promise<SharedProjectResponse> {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: link.projectId },
      include: {
        owner: { select: { firstName: true } },
        statuses: { orderBy: { order: 'asc' } },
        tasks: {
          include: {
            status: { select: { order: true } },
            checklist: { orderBy: { order: 'asc' } },
          },
          orderBy: [{ status: { order: 'asc' } }, { order: 'asc' }],
        },
      },
    });
    const progress = await this.projects.progressFor([project.id]);

    const payload: ShareSessionPayload = {
      kind: 'project-share',
      linkId: link.id,
      projectId: project.id,
    };
    const untilExpiry = link.expiresAt
      ? Math.floor((link.expiresAt.getTime() - Date.now()) / 1000)
      : LIVE_SESSION_SECONDS;
    const liveToken = await this.jwt.signAsync(payload, {
      secret: shareSessionSecret(this.config.getOrThrow('JWT_SECRET')),
      expiresIn: Math.max(1, Math.min(LIVE_SESSION_SECONDS, untilExpiry)),
    });

    return {
      title: project.title,
      description: project.description,
      type: project.type,
      status: project.status,
      key: project.key,
      color: project.color,
      dueDate: project.dueDate,
      sharedBy: project.owner.firstName,
      label: link.label,
      access: link.access,
      progress: progress.get(project.id) ?? {
        total: 0,
        todo: 0,
        inProgress: 0,
        done: 0,
        overdue: 0,
      },
      statuses: project.statuses.map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        category: s.category,
      })),
      tasks: project.tasks.map((t) => ({
        id: t.id,
        key: taskKey(project.key, t.number),
        title: t.title,
        notes: t.notes,
        statusId: t.statusId,
        quantity: t.quantity === null ? null : t.quantity.toNumber(),
        unit: t.unit,
        dueDate: t.dueDate,
        completedAt: t.completedAt,
        parentTaskId: t.parentTaskId,
        checklist: t.checklist.map((c) => ({
          content: c.content,
          done: c.done,
        })),
      })),
      liveToken,
    };
  }
}

const toLink = (link: LinkRow): ShareLinkResponse => ({
  id: link.id,
  label: link.label,
  access: link.access,
  hasPassword: !!link.passwordHash,
  expiresAt: link.expiresAt,
  revokedAt: link.revokedAt,
  lastUsedAt: link.lastUsedAt,
  openCount: link.openCount,
  active: isLinkActive(link),
  createdBy: link.createdBy,
  createdAt: link.createdAt,
});
