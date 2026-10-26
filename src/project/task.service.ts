import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RepeatType, StatusCategory } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { BomService } from './bom.service';
import {
  CreateChecklistItemDto,
  CreateTaskDto,
  ListTasksQueryDto,
  MoveTaskDto,
  MoveTaskToProjectDto,
  MyTasksView,
  UpdateChecklistItemDto,
  UpdateTaskDto,
} from './dto';
import { ProjectAccess, ProjectAccessService } from './project-access.service';
import { taskKey } from './project-defaults';
import { dateIn } from './calendar/ical';
import { nextOccurrence, streakDays, weekStart } from './task-rules';
import { ProjectEventsService } from './project-events.service';
import { USER_SELECT } from './project.service';
import {
  ChecklistItemResponse,
  MovedTaskResponse,
  MyTaskStatsResponse,
  TaskDetailResponse,
  TaskResponse,
} from './responses';

const TASK_INCLUDE = {
  project: { select: { id: true, title: true, key: true, isInbox: true } },
  status: { select: { id: true, name: true, color: true, category: true } },
  assignee: { select: USER_SELECT },
  createdBy: { select: USER_SELECT },
  completedBy: { select: USER_SELECT },
  checklist: { select: { done: true } },
  _count: { select: { subtasks: true, comments: true, documents: true } },
} satisfies Prisma.TaskInclude;

type TaskRow = Prisma.TaskGetPayload<{ include: typeof TASK_INCLUDE }>;

const nullableDate = (value?: string | null) =>
  value === undefined ? undefined : value === null ? null : new Date(value);

const endOfDay = (days: number) => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  d.setDate(d.getDate() + days);
  return d;
};

/**
 * Tasks inside projects: keys, the board, completion and checklists. Status
 * logic follows the category of the project's workflow status, never its
 * name (D13, I8).
 */
@Injectable()
export class TaskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly events: ProjectEventsService,
    private readonly bom: BomService,
  ) {}

  async list(
    userId: string,
    projectId: string,
    query: ListTasksQueryDto,
  ): Promise<TaskResponse[]> {
    await this.access.assert(userId, projectId, ProjectAccess.VIEW);

    const term = query.q?.trim();
    const number = term?.match(/^(?:[A-Za-z][A-Za-z0-9]*-)?(\d+)$/)?.[1];
    const tasks = await this.prisma.task.findMany({
      where: {
        projectId,
        ...(query.withSubtasks ? {} : { parentTaskId: null }),
        ...(query.statusId ? { statusId: query.statusId } : {}),
        ...(query.category ? { status: { category: query.category } } : {}),
        ...(query.assigneeId
          ? {
              assigneeId: query.assigneeId === 'me' ? userId : query.assigneeId,
            }
          : {}),
        ...(term
          ? {
              OR: [
                { title: { contains: term, mode: 'insensitive' } },
                ...(number ? [{ number: Number(number) }] : []),
              ],
            }
          : {}),
      },
      include: TASK_INCLUDE,
      orderBy: [{ status: { order: 'asc' } }, { order: 'asc' }],
    });
    return tasks.map(toTask);
  }

  /**
   * Your open work across every project you can see: assigned to you, or in
   * your inbox. The cross-project view of "what is on my plate".
   */
  async mine(userId: string, view = MyTasksView.OPEN): Promise<TaskResponse[]> {
    const due =
      view === MyTasksView.TODAY
        ? { lte: endOfDay(0) }
        : view === MyTasksView.WEEK
          ? { lte: endOfDay(7) }
          : view === MyTasksView.OVERDUE
            ? { lt: new Date() }
            : undefined;

    const tasks = await this.prisma.task.findMany({
      where: {
        status: { category: { not: StatusCategory.DONE } },
        project: {
          archivedAt: null,
          // A template's tasks are a plan to copy, not work to do.
          isTemplate: false,
          OR: [{ ownerId: userId }, { members: { some: { userId } } }],
        },
        OR: [
          { assigneeId: userId },
          { project: { isInbox: true, ownerId: userId } },
        ],
        ...(due ? { dueDate: due } : {}),
      },
      include: TASK_INCLUDE,
      orderBy: [
        { dueDate: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'asc' },
      ],
      take: 500,
    });
    return tasks.map(toTask);
  }

  /**
   * What you finished today, this week (from Monday) and how many days in a
   * row: counted from who ticked tasks off, in the calendar's time zone.
   */
  async stats(
    userId: string,
    now: Date = new Date(),
  ): Promise<MyTaskStatsResponse> {
    const zone = process.env.CALENDAR_TIMEZONE || 'Europe/Warsaw';
    const today = dateIn(now, zone);
    const [done, open] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          completedById: userId,
          completedAt: { gte: new Date(now.getTime() - 120 * 86_400_000) },
          project: { isTemplate: false },
        },
        select: { completedAt: true },
      }),
      this.prisma.task.count({
        where: {
          status: { category: { not: StatusCategory.DONE } },
          project: {
            archivedAt: null,
            isTemplate: false,
            OR: [{ ownerId: userId }, { members: { some: { userId } } }],
          },
          OR: [
            { assigneeId: userId },
            { project: { isInbox: true, ownerId: userId } },
          ],
        },
      }),
    ]);
    const days = done.map((t) => dateIn(t.completedAt!, zone));
    const monday = weekStart(today);
    return {
      doneToday: days.filter((d) => d === today).length,
      doneThisWeek: days.filter((d) => d >= monday).length,
      streakDays: streakDays(new Set(days), today),
      open,
    };
  }

  async get(userId: string, taskId: string): Promise<TaskDetailResponse> {
    await this.access.assertTask(userId, taskId, ProjectAccess.VIEW);
    return this.detail(taskId);
  }

  async create(
    userId: string,
    projectId: string,
    dto: CreateTaskDto,
  ): Promise<TaskDetailResponse> {
    await this.access.assert(userId, projectId, ProjectAccess.EDIT);

    const status = dto.statusId
      ? await this.statusOf(projectId, dto.statusId)
      : await this.firstStatus(projectId, StatusCategory.TODO);
    if (dto.assigneeId)
      await this.assertCanBeAssigned(projectId, dto.assigneeId);
    if (dto.parentTaskId) await this.assertParent(projectId, dto.parentTaskId);

    const task = await this.prisma.$transaction(async (tx) => {
      // The counter is bumped in the same transaction, so two tasks created
      // at once can never share a number (D14).
      const { taskCounter } = await tx.project.update({
        where: { id: projectId },
        data: { taskCounter: { increment: 1 } },
        select: { taskCounter: true },
      });
      const last = await tx.task.findFirst({
        where: { statusId: status.id },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      const done = status.category === StatusCategory.DONE;

      return tx.task.create({
        data: {
          projectId,
          number: taskCounter,
          title: dto.title.trim(),
          notes: dto.notes ?? null,
          statusId: status.id,
          priority: dto.priority,
          dueDate: nullableDate(dto.dueDate),
          reminderAt: nullableDate(dto.reminderAt),
          repeat: dto.repeat,
          repeatCustom: dto.repeatCustom ?? null,
          quantity: dto.quantity ?? null,
          unit: dto.unit ?? null,
          assigneeId: dto.assigneeId ?? null,
          parentTaskId: dto.parentTaskId ?? null,
          createdById: userId,
          order: (last?.order ?? -1) + 1,
          ...(done ? { completedAt: new Date(), completedById: userId } : {}),
        },
      });
    });

    this.notify(userId, projectId, task.id);
    return this.detail(task.id);
  }

  async update(
    userId: string,
    taskId: string,
    dto: UpdateTaskDto,
  ): Promise<TaskDetailResponse> {
    const { project } = await this.access.assertTask(
      userId,
      taskId,
      ProjectAccess.EDIT,
    );
    const current = await this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      include: { status: true },
    });

    if (dto.assigneeId)
      await this.assertCanBeAssigned(project.id, dto.assigneeId);
    if (dto.parentTaskId) {
      await this.assertParent(project.id, dto.parentTaskId, taskId);
    }

    const data: Prisma.TaskUncheckedUpdateInput = {
      title: dto.title?.trim(),
      notes: dto.notes,
      priority: dto.priority,
      dueDate: nullableDate(dto.dueDate),
      reminderAt: nullableDate(dto.reminderAt),
      repeat: dto.repeat,
      repeatCustom: dto.repeatCustom,
      quantity: dto.quantity,
      unit: dto.unit,
      assigneeId: dto.assigneeId,
      parentTaskId: dto.parentTaskId,
    };

    if (dto.statusId && dto.statusId !== current.statusId) {
      const target = await this.statusOf(project.id, dto.statusId);
      const last = await this.prisma.task.findFirst({
        where: { statusId: target.id },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      Object.assign(
        data,
        { statusId: target.id, order: (last?.order ?? -1) + 1 },
        completion(current.status.category, target.category, userId),
      );
    }

    const before = current.status.category;
    await this.prisma.task.update({ where: { id: taskId }, data });
    if (data.statusId) {
      const after = (await this.statusOf(project.id, data.statusId as string))
        .category;
      await this.afterCategoryChange(taskId, before, after, userId);
    }
    this.notify(userId, project.id, taskId);
    return this.detail(taskId);
  }

  /**
   * Into another project, with its subtasks, checklist and comments. Each
   * gets the next number there and the first status of the same category;
   * an assignee who is not in the target is dropped, and so are blocks with
   * tasks left behind and pins of other people's files (D8).
   */
  async moveToProject(
    userId: string,
    taskId: string,
    dto: MoveTaskToProjectDto,
  ): Promise<MovedTaskResponse> {
    const { project: source } = await this.access.assertTask(
      userId,
      taskId,
      ProjectAccess.EDIT,
    );
    if (dto.projectId === source.id) {
      throw new BadRequestException('The task is already in that project.');
    }
    await this.access.assert(userId, dto.projectId, ProjectAccess.EDIT);

    const task = await this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      include: {
        status: true,
        subtasks: { include: { status: true }, orderBy: { number: 'asc' } },
      },
    });
    const moving = [task, ...task.subtasks];
    const ids = moving.map((t) => t.id);

    const target = await this.prisma.projectTaskStatus.findMany({
      where: { projectId: dto.projectId },
      orderBy: { order: 'asc' },
    });
    const chosen = dto.statusId
      ? await this.statusOf(dto.projectId, dto.statusId)
      : null;
    const statusFor = (category: StatusCategory) =>
      target.find((s) => s.category === category) ??
      target.find((s) => s.category === StatusCategory.TODO)!;
    const people = new Set(await this.access.audience(dto.projectId));

    const pins = await this.prisma.documentLink.findMany({
      where: { taskId: { in: ids } },
      select: { id: true, document: { select: { ownerId: true } } },
    });
    const foreignPins = pins
      .filter((p) => p.document.ownerId !== userId)
      .map((p) => p.id);

    await this.prisma.$transaction(async (tx) => {
      const { taskCounter } = await tx.project.update({
        where: { id: dto.projectId },
        data: { taskCounter: { increment: moving.length } },
        select: { taskCounter: true },
      });
      let number = taskCounter - moving.length;
      for (const t of moving) {
        const status =
          t.id === task.id && chosen ? chosen : statusFor(t.status.category);
        const last = await tx.task.findFirst({
          where: { statusId: status.id },
          orderBy: { order: 'desc' },
          select: { order: true },
        });
        await tx.task.update({
          where: { id: t.id },
          data: {
            projectId: dto.projectId,
            number: ++number,
            statusId: status.id,
            order: (last?.order ?? -1) + 1,
            // A moved subtask on its own becomes a task of its own there.
            ...(t.id === task.id ? { parentTaskId: null } : {}),
            ...(t.assigneeId && !people.has(t.assigneeId)
              ? { assigneeId: null }
              : {}),
            ...completion(t.status.category, status.category, userId),
          },
        });
      }
      await tx.taskBlock.deleteMany({
        where: {
          OR: [
            { blockerId: { in: ids }, blockedId: { notIn: ids } },
            { blockedId: { in: ids }, blockerId: { notIn: ids } },
          ],
        },
      });
      if (foreignPins.length) {
        await tx.documentLink.deleteMany({
          where: { id: { in: foreignPins } },
        });
      }
    });

    this.notify(userId, source.id, taskId);
    this.notify(userId, dto.projectId, taskId);
    return {
      task: await this.detail(taskId),
      droppedDocuments: foreignPins.length,
    };
  }

  /** Drag on the board: into a column, at a position; the column is renumbered. */
  async move(
    userId: string,
    taskId: string,
    dto: MoveTaskDto,
  ): Promise<TaskDetailResponse> {
    const { project } = await this.access.assertTask(
      userId,
      taskId,
      ProjectAccess.EDIT,
    );
    const target = await this.statusOf(project.id, dto.statusId);
    const current = await this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      include: { status: true },
    });

    await this.prisma.$transaction(async (tx) => {
      const column = await tx.task.findMany({
        where: { statusId: target.id, parentTaskId: null, id: { not: taskId } },
        orderBy: { order: 'asc' },
        select: { id: true },
      });
      const index = Math.min(dto.index ?? column.length, column.length);
      const ids = column.map((t) => t.id);
      ids.splice(index, 0, taskId);

      for (const [order, id] of ids.entries()) {
        await tx.task.update({
          where: { id },
          data:
            id === taskId
              ? {
                  statusId: target.id,
                  order,
                  ...completion(
                    current.status.category,
                    target.category,
                    userId,
                  ),
                }
              : { order },
        });
      }
    });

    await this.afterCategoryChange(
      taskId,
      current.status.category,
      target.category,
      userId,
    );
    this.notify(userId, project.id, taskId);
    return this.detail(taskId);
  }

  /**
   * Tick on, tick off: between the first done status and the first to-do one.
   * Viewers may do it when the project allows them to (a shared shopping list).
   */
  async toggle(userId: string, taskId: string): Promise<TaskDetailResponse> {
    const { project } = await this.access.assertTask(
      userId,
      taskId,
      ProjectAccess.CHECK,
    );
    await this.applyToggle(project.id, taskId, userId);
    return this.detail(taskId);
  }

  /**
   * Done ↔ not done: into the first DONE status, or back to the first TODO.
   * Access is the caller's to check; `actorId` is null for a public link.
   */
  async applyToggle(
    projectId: string,
    taskId: string,
    actorId: string | null,
  ): Promise<void> {
    const current = await this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      include: { status: true },
    });

    const done = current.status.category === StatusCategory.DONE;
    const target = await this.firstStatus(
      projectId,
      done ? StatusCategory.TODO : StatusCategory.DONE,
    );
    const last = await this.prisma.task.findFirst({
      where: { statusId: target.id },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    await this.prisma.task.update({
      where: { id: taskId },
      data: {
        statusId: target.id,
        order: (last?.order ?? -1) + 1,
        ...completion(current.status.category, target.category, actorId),
      },
    });
    await this.afterCategoryChange(
      taskId,
      current.status.category,
      target.category,
      actorId,
    );

    this.notify(actorId, projectId, taskId);
  }

  async remove(userId: string, taskId: string): Promise<void> {
    const { project } = await this.access.assertTask(
      userId,
      taskId,
      ProjectAccess.EDIT,
    );
    await this.prisma.task.delete({ where: { id: taskId } });
    this.notify(userId, project.id, taskId);
  }

  // — checklist —

  async addChecklistItem(
    userId: string,
    taskId: string,
    dto: CreateChecklistItemDto,
  ): Promise<ChecklistItemResponse[]> {
    const { project } = await this.access.assertTask(
      userId,
      taskId,
      ProjectAccess.EDIT,
    );
    const last = await this.prisma.taskChecklistItem.findFirst({
      where: { taskId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    await this.prisma.taskChecklistItem.create({
      data: {
        taskId,
        content: dto.content.trim(),
        order: (last?.order ?? -1) + 1,
      },
    });
    this.notify(userId, project.id, taskId);
    return this.checklist(taskId);
  }

  async updateChecklistItem(
    userId: string,
    taskId: string,
    itemId: string,
    dto: UpdateChecklistItemDto,
  ): Promise<ChecklistItemResponse[]> {
    // Ticking is a check; rewording is an edit.
    const needed =
      dto.content !== undefined ? ProjectAccess.EDIT : ProjectAccess.CHECK;
    const { project } = await this.access.assertTask(userId, taskId, needed);

    const { count } = await this.prisma.taskChecklistItem.updateMany({
      where: { id: itemId, taskId },
      data: { content: dto.content?.trim(), done: dto.done },
    });
    if (!count) throw new NotFoundException('Checklist item not found');

    this.notify(userId, project.id, taskId);
    return this.checklist(taskId);
  }

  async reorderChecklist(
    userId: string,
    taskId: string,
    ids: string[],
  ): Promise<ChecklistItemResponse[]> {
    const { project } = await this.access.assertTask(
      userId,
      taskId,
      ProjectAccess.EDIT,
    );
    const items = await this.prisma.taskChecklistItem.findMany({
      where: { taskId },
      select: { id: true },
    });
    const known = new Set(items.map((i) => i.id));
    if (ids.length !== known.size || !ids.every((id) => known.has(id))) {
      throw new BadRequestException('Send every checklist item exactly once.');
    }
    await this.prisma.$transaction(
      ids.map((id, order) =>
        this.prisma.taskChecklistItem.update({
          where: { id },
          data: { order },
        }),
      ),
    );
    this.notify(userId, project.id, taskId);
    return this.checklist(taskId);
  }

  async removeChecklistItem(
    userId: string,
    taskId: string,
    itemId: string,
  ): Promise<ChecklistItemResponse[]> {
    const { project } = await this.access.assertTask(
      userId,
      taskId,
      ProjectAccess.EDIT,
    );
    const { count } = await this.prisma.taskChecklistItem.deleteMany({
      where: { id: itemId, taskId },
    });
    if (!count) throw new NotFoundException('Checklist item not found');

    this.notify(userId, project.id, taskId);
    return this.checklist(taskId);
  }

  // — internals —

  private async detail(taskId: string): Promise<TaskDetailResponse> {
    const task = await this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      include: {
        ...TASK_INCLUDE,
        parentTask: {
          select: { id: true, number: true, title: true },
        },
        subtasks: {
          include: TASK_INCLUDE,
          orderBy: [{ status: { order: 'asc' } }, { order: 'asc' }],
        },
      },
    });

    return {
      ...toTask(task),
      checklistItems: await this.checklist(taskId),
      subtasks: task.subtasks.map(toTask),
      parent: task.parentTask
        ? {
            id: task.parentTask.id,
            key: taskKey(task.project.key, task.parentTask.number),
            title: task.parentTask.title,
          }
        : null,
    };
  }

  private async checklist(taskId: string): Promise<ChecklistItemResponse[]> {
    return this.prisma.taskChecklistItem.findMany({
      where: { taskId },
      orderBy: { order: 'asc' },
      select: { id: true, content: true, done: true, order: true },
    });
  }

  private async statusOf(projectId: string, statusId: string) {
    const status = await this.prisma.projectTaskStatus.findFirst({
      where: { id: statusId, projectId },
    });
    if (!status)
      throw new BadRequestException('That status is not in this project.');
    return status;
  }

  private async firstStatus(projectId: string, category: StatusCategory) {
    const status = await this.prisma.projectTaskStatus.findFirst({
      where: { projectId, category },
      orderBy: { order: 'asc' },
    });
    // I8 makes this unreachable; kept so a broken workflow fails loudly.
    if (!status) {
      throw new BadRequestException(`The project has no ${category} status.`);
    }
    return status;
  }

  private async assertCanBeAssigned(projectId: string, assigneeId: string) {
    const ok = await this.prisma.project.count({
      where: {
        id: projectId,
        OR: [
          { ownerId: assigneeId },
          { members: { some: { userId: assigneeId } } },
        ],
      },
    });
    if (!ok) {
      throw new BadRequestException(
        'Only people in the project can be assigned.',
      );
    }
  }

  private async assertParent(
    projectId: string,
    parentId: string,
    selfId?: string,
  ) {
    if (parentId === selfId) {
      throw new BadRequestException('A task cannot be its own parent.');
    }
    const parent = await this.prisma.task.findFirst({
      where: { id: parentId, projectId },
      select: { parentTaskId: true },
    });
    if (!parent) {
      throw new BadRequestException('The parent task is not in this project.');
    }
    // One level only: a subtask's subtask would hide work from the board.
    if (parent.parentTaskId) {
      throw new BadRequestException(
        'Subtasks cannot have subtasks of their own.',
      );
    }
  }

  /**
   * A repeating task, once done, hands its repeat on to the next occurrence:
   * a fresh copy due one step later (checklist unticked), so the done one
   * stays done and ticking it again never makes a second copy.
   */
  /**
   * What follows a task becoming done or undone: a repeating task hands its
   * repeat on, a shopping-list line moves its part along.
   */
  private async afterCategoryChange(
    taskId: string,
    from: StatusCategory,
    to: StatusCategory,
    actorId: string | null,
  ) {
    const entered = to === StatusCategory.DONE && from !== StatusCategory.DONE;
    const left = from === StatusCategory.DONE && to !== StatusCategory.DONE;
    if (!entered && !left) return;
    if (entered) await this.repeatAfterDone(taskId, actorId);
    await this.bom.followShopping(taskId, entered, actorId);
  }

  private async repeatAfterDone(taskId: string, actorId: string | null) {
    const task = await this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      include: { checklist: { orderBy: { order: 'asc' } } },
    });
    const base = task.dueDate ?? new Date();
    const due = nextOccurrence(base, task.repeat, task.repeatCustom);
    if (!due) return;
    const todo = await this.firstStatus(task.projectId, StatusCategory.TODO);

    const next = await this.prisma.$transaction(async (tx) => {
      const { taskCounter } = await tx.project.update({
        where: { id: task.projectId },
        data: { taskCounter: { increment: 1 } },
        select: { taskCounter: true },
      });
      const last = await tx.task.findFirst({
        where: { statusId: todo.id },
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      await tx.task.update({
        where: { id: taskId },
        data: { repeat: RepeatType.NONE, repeatCustom: null },
      });
      return tx.task.create({
        data: {
          projectId: task.projectId,
          number: taskCounter,
          title: task.title,
          notes: task.notes,
          statusId: todo.id,
          priority: task.priority,
          dueDate: due,
          reminderAt: task.reminderAt
            ? new Date(
                task.reminderAt.getTime() + (due.getTime() - base.getTime()),
              )
            : null,
          repeat: task.repeat,
          repeatCustom: task.repeatCustom,
          quantity: task.quantity,
          unit: task.unit,
          assigneeId: task.assigneeId,
          parentTaskId: task.parentTaskId,
          createdById: actorId ?? task.createdById,
          order: (last?.order ?? -1) + 1,
          checklist: {
            create: task.checklist.map((c) => ({
              content: c.content,
              order: c.order,
            })),
          },
        },
      });
    });
    this.notify(actorId, task.projectId, next.id);
  }

  private notify(actorId: string | null, projectId: string, taskId: string) {
    void this.events.changed({ projectId, kind: 'task', taskId, actorId });
  }
}

/** completedAt follows the category of the status the task enters (I8). */
export const completion = (
  from: StatusCategory,
  to: StatusCategory,
  userId: string | null,
): Prisma.TaskUncheckedUpdateInput => {
  if (to === StatusCategory.DONE && from !== StatusCategory.DONE) {
    return { completedAt: new Date(), completedById: userId };
  }
  if (from === StatusCategory.DONE && to !== StatusCategory.DONE) {
    return { completedAt: null, completedById: null };
  }
  return {};
};

export const toTask = (task: TaskRow): TaskResponse => ({
  id: task.id,
  key: taskKey(task.project.key, task.number),
  number: task.number,
  project: task.project,
  title: task.title,
  notes: task.notes,
  status: task.status,
  priority: task.priority,
  dueDate: task.dueDate,
  reminderAt: task.reminderAt,
  repeat: task.repeat,
  repeatCustom: task.repeatCustom,
  quantity: task.quantity === null ? null : Number(task.quantity),
  unit: task.unit,
  order: task.order,
  completedAt: task.completedAt,
  completedBy: task.completedBy,
  assignee: task.assignee,
  createdBy: task.createdBy,
  parentTaskId: task.parentTaskId,
  checklist: {
    total: task.checklist.length,
    done: task.checklist.filter((i) => i.done).length,
  },
  subtaskCount: task._count.subtasks,
  commentCount: task._count.comments,
  documentCount: task._count.documents,
  overdue:
    !!task.dueDate &&
    task.dueDate < new Date() &&
    task.status.category !== StatusCategory.DONE,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
});
