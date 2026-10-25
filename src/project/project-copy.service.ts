import { Injectable } from '@nestjs/common';
import { BomStatus, Prisma, StatusCategory } from '@prisma/client';
import { randomUUID } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { DuplicateProjectDto } from './dto';
import { ProjectAccess, ProjectAccessService } from './project-access.service';
import { ProjectService } from './project.service';
import { DuplicateProjectResponse } from './responses';

/** How far the copy's dates move: from the old start to the new one. */
export const dateShift = (
  from: Date | null | undefined,
  to: Date | null | undefined,
): number => (from && to ? to.getTime() - from.getTime() : 0);

export const shifted = (date: Date | null, shift: number): Date | null =>
  date ? new Date(date.getTime() + shift) : null;

/**
 * Duplicates and templates (D12). A copy takes the plan, not the history:
 * statuses, tasks with their subtasks, checklists and blocks, and the parts
 * list, every one of them back at its start (first To do, Needed, nothing
 * ticked). Members, links, the journal, comments and tags stay behind (I7);
 * so do other people's assignments. Documents are pinned again only when
 * they are yours.
 */
@Injectable()
export class ProjectCopyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly projects: ProjectService,
  ) {}

  async duplicate(
    userId: string,
    sourceId: string,
    dto: DuplicateProjectDto,
  ): Promise<DuplicateProjectResponse> {
    // Seeing a project is enough to start your own from it.
    await this.access.assert(userId, sourceId, ProjectAccess.VIEW);
    const source = await this.prisma.project.findUniqueOrThrow({
      where: { id: sourceId },
      include: {
        statuses: { orderBy: { order: 'asc' } },
        tasks: {
          include: { checklist: true, blocks: true },
          orderBy: { number: 'asc' },
        },
        bom: true,
        documents: { select: { documentId: true } },
      },
    });

    const title = dto.title.trim();
    const key = await this.projects.resolveKey(userId, title);
    const startDate =
      dto.startDate === undefined
        ? source.startDate
        : dto.startDate
          ? new Date(dto.startDate)
          : null;
    const shift = dateShift(source.startDate, startDate);

    const projectId = randomUUID();
    const statusIds = new Map(source.statuses.map((s) => [s.id, randomUUID()]));
    const firstTodo = source.statuses.find(
      (s) => s.category === StatusCategory.TODO,
    )!;
    const todoId = statusIds.get(firstTodo.id)!;
    const taskIds = new Map(source.tasks.map((t) => [t.id, randomUUID()]));
    const bomIds = new Map(source.bom.map((b) => [b.id, randomUUID()]));

    // Documents: yours travel with the copy, someone else's are theirs to pin.
    const [taskPins, bomPins] = await Promise.all([
      this.prisma.documentLink.findMany({
        where: { task: { projectId: sourceId } },
        select: { documentId: true, taskId: true },
      }),
      this.prisma.documentLink.findMany({
        where: { bomItem: { projectId: sourceId } },
        select: { documentId: true, bomItemId: true },
      }),
    ]);
    const allPins = [
      ...source.documents.map((d) => ({ documentId: d.documentId })),
      ...taskPins,
      ...bomPins,
    ];
    const owned = new Set(
      (
        await this.prisma.document.findMany({
          where: {
            id: { in: [...new Set(allPins.map((p) => p.documentId))] },
            ownerId: userId,
          },
          select: { id: true },
        })
      ).map((d) => d.id),
    );

    // Parents first, so a subtask's parent exists when it is created.
    const tasks = [...source.tasks].sort(
      (a, b) => Number(!!a.parentTaskId) - Number(!!b.parentTaskId),
    );

    await this.prisma.$transaction([
      this.prisma.project.create({
        data: {
          id: projectId,
          title,
          description: source.description,
          type: source.type,
          key,
          taskCounter: source.tasks.length,
          startDate,
          dueDate: shifted(source.dueDate, shift),
          color: source.color,
          icon: source.icon,
          viewersCanCheck: source.viewersCanCheck,
          isTemplate: !!dto.asTemplate,
          ownerId: userId,
        },
      }),
      this.prisma.projectTaskStatus.createMany({
        data: source.statuses.map((s) => ({
          id: statusIds.get(s.id)!,
          projectId,
          name: s.name,
          color: s.color,
          category: s.category,
          order: s.order,
        })),
      }),
      ...tasks.map((t, i) =>
        this.prisma.task.create({
          data: {
            id: taskIds.get(t.id)!,
            projectId,
            // Renumbered from 1, in the source's order.
            number: source.tasks.indexOf(t) + 1,
            title: t.title,
            notes: t.notes,
            statusId: todoId,
            priority: t.priority,
            dueDate: shifted(t.dueDate, shift),
            reminderAt: shifted(t.reminderAt, shift),
            repeat: t.repeat,
            repeatCustom: t.repeatCustom,
            quantity: t.quantity,
            unit: t.unit,
            order: i,
            assigneeId: t.assigneeId === userId ? userId : null,
            createdById: userId,
            parentTaskId: t.parentTaskId ? taskIds.get(t.parentTaskId) : null,
          },
        }),
      ),
      this.prisma.taskChecklistItem.createMany({
        data: source.tasks.flatMap((t) =>
          t.checklist.map((c) => ({
            taskId: taskIds.get(t.id)!,
            content: c.content,
            done: false,
            order: c.order,
          })),
        ),
      }),
      this.prisma.taskBlock.createMany({
        data: source.tasks.flatMap((t) =>
          t.blocks
            .filter((b) => taskIds.has(b.blockedId))
            .map((b) => ({
              blockerId: taskIds.get(b.blockerId)!,
              blockedId: taskIds.get(b.blockedId)!,
            })),
        ),
      }),
      this.prisma.bomItem.createMany({
        data: source.bom.map((b) => ({
          id: bomIds.get(b.id)!,
          projectId,
          name: b.name,
          quantity: b.quantity,
          unit: b.unit,
          status: BomStatus.NEEDED,
          unitPrice: b.unitPrice,
          currency: b.currency,
          supplier: b.supplier,
          url: b.url,
          note: b.note,
          gearItemId: b.gearItemId,
          order: b.order,
        })),
      }),
      this.prisma.documentLink.createMany({
        data: [
          ...source.documents
            .filter((d) => owned.has(d.documentId))
            .map((d) => ({ documentId: d.documentId, projectId })),
          ...taskPins
            .filter((p) => owned.has(p.documentId))
            .map((p) => ({
              documentId: p.documentId,
              taskId: taskIds.get(p.taskId!)!,
            })),
          ...bomPins
            .filter((p) => owned.has(p.documentId))
            .map((p) => ({
              documentId: p.documentId,
              bomItemId: bomIds.get(p.bomItemId!)!,
            })),
        ].map(
          (link) =>
            ({
              ...link,
              addedById: userId,
            }) satisfies Prisma.DocumentLinkCreateManyInput,
        ),
      }),
    ]);

    return {
      project: await this.projects.get(userId, projectId),
      skippedDocuments: allPins.filter((p) => !owned.has(p.documentId)).length,
    };
  }
}
