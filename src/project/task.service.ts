import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StatusCategory } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import {
  CreateChecklistItemDto,
  CreateTaskDto,
  ListTasksQueryDto,
  MoveTaskDto,
  MyTasksView,
  UpdateChecklistItemDto,
  UpdateTaskDto,
} from './dto';
import { ProjectAccess, ProjectAccessService } from './project-access.service';
import { taskKey } from './project-defaults';
import { ProjectEventsService } from './project-events.service';
import { USER_SELECT } from './project.service';
import {
  ChecklistItemResponse,
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
  _count: { select: { subtasks: true } },
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

    await this.prisma.task.update({ where: { id: taskId }, data });
    this.notify(userId, project.id, taskId);
    return this.detail(taskId);
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
  overdue:
    !!task.dueDate &&
    task.dueDate < new Date() &&
    task.status.category !== StatusCategory.DONE,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
});
