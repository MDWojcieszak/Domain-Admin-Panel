import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, ProjectRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateJournalEntryDto, UpdateJournalEntryDto } from './dto';
import { ProjectAccess, ProjectAccessService } from './project-access.service';
import { ProjectEventsService } from './project-events.service';
import { USER_SELECT } from './project.service';
import { JournalEntryResponse } from './responses';

const ENTRY_INCLUDE = {
  author: { select: USER_SELECT },
  _count: { select: { comments: true, documents: true } },
} satisfies Prisma.JournalEntryInclude;

type EntryRow = Prisma.JournalEntryGetPayload<{
  include: typeof ENTRY_INCLUDE;
}>;

/**
 * The work journal of a build (D6): its documentation, entry by entry.
 * Editors write; an entry is changed or deleted by its author, or by the
 * project's owner.
 */
@Injectable()
export class JournalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly events: ProjectEventsService,
  ) {}

  async list(
    userId: string,
    projectId: string,
  ): Promise<JournalEntryResponse[]> {
    const { role } = await this.access.assert(
      userId,
      projectId,
      ProjectAccess.VIEW,
    );
    const entries = await this.prisma.journalEntry.findMany({
      where: { projectId },
      include: ENTRY_INCLUDE,
      orderBy: [{ happenedAt: 'desc' }, { createdAt: 'desc' }],
    });
    return entries.map((e) => toEntry(e, userId, role));
  }

  async create(
    userId: string,
    projectId: string,
    dto: CreateJournalEntryDto,
  ): Promise<JournalEntryResponse> {
    const { role } = await this.access.assert(
      userId,
      projectId,
      ProjectAccess.EDIT,
    );
    const entry = await this.prisma.journalEntry.create({
      data: {
        projectId,
        authorId: userId,
        title: dto.title?.trim() || null,
        body: dto.body,
        happenedAt: dto.happenedAt ? new Date(dto.happenedAt) : undefined,
      },
      include: ENTRY_INCLUDE,
    });
    this.notify(userId, projectId);
    return toEntry(entry, userId, role);
  }

  async update(
    userId: string,
    entryId: string,
    dto: UpdateJournalEntryDto,
  ): Promise<JournalEntryResponse> {
    const { entry, role } = await this.assertMayChange(userId, entryId);
    const updated = await this.prisma.journalEntry.update({
      where: { id: entryId },
      data: {
        title: dto.title === undefined ? undefined : dto.title?.trim() || null,
        body: dto.body,
        happenedAt: dto.happenedAt ? new Date(dto.happenedAt) : undefined,
      },
      include: ENTRY_INCLUDE,
    });
    this.notify(userId, entry.projectId);
    return toEntry(updated, userId, role);
  }

  async remove(userId: string, entryId: string): Promise<void> {
    const { entry } = await this.assertMayChange(userId, entryId);
    await this.prisma.journalEntry.delete({ where: { id: entryId } });
    this.notify(userId, entry.projectId);
  }

  private async assertMayChange(userId: string, entryId: string) {
    const grant = await this.access.assertJournalEntry(
      userId,
      entryId,
      ProjectAccess.EDIT,
    );
    if (!mayChange(grant.entry.authorId, userId, grant.role)) {
      throw new ForbiddenException(
        'Only its author or the project owner changes a journal entry.',
      );
    }
    return grant;
  }

  private notify(actorId: string, projectId: string) {
    void this.events.changed({ projectId, kind: 'journal', actorId });
  }
}

const mayChange = (authorId: string, userId: string, role: ProjectRole) =>
  authorId === userId || role === ProjectRole.OWNER;

const toEntry = (
  entry: EntryRow,
  userId: string,
  role: ProjectRole,
): JournalEntryResponse => ({
  id: entry.id,
  title: entry.title,
  body: entry.body,
  happenedAt: entry.happenedAt,
  author: entry.author,
  // A viewer may have written it before being demoted; editing needs EDIT.
  canEdit:
    role !== ProjectRole.VIEWER && mayChange(entry.authorId, userId, role),
  commentCount: entry._count.comments,
  documentCount: entry._count.documents,
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
});
