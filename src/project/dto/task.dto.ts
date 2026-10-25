import { RepeatType, StatusCategory, TaskPriority } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

import { toBoolean } from '../../common/helpers/cast.helper';
import { CUSTOM_REPEAT } from '../task-rules';

export class CreateTaskDto {
  @IsString({ minLength: 1, maxLength: 500 })
  title: string;

  @IsString({ optional: true, nullable: true })
  notes?: string | null;

  /** The project's first to-do status when omitted. */
  @IsString({ optional: true })
  statusId?: string;

  @IsEnum({ enum: { TaskPriority }, optional: true })
  priority?: TaskPriority;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  dueDate?: string | null;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  reminderAt?: string | null;

  @IsEnum({ enum: { RepeatType }, optional: true })
  repeat?: RepeatType;

  /** With repeat CUSTOM: "3d", "2w", "6m", "1y". */
  @IsString({
    optional: true,
    nullable: true,
    pattern: { regex: CUSTOM_REPEAT },
  })
  repeatCustom?: string | null;

  @IsNumber({ min: 0, optional: true, nullable: true })
  quantity?: number | null;

  @IsString({ optional: true, nullable: true })
  unit?: string | null;

  /** The owner or a member of the project. */
  @IsString({ optional: true, nullable: true })
  assigneeId?: string | null;

  /** A task of the same project. */
  @IsString({ optional: true, nullable: true })
  parentTaskId?: string | null;
}

export class UpdateTaskDto {
  @IsString({ minLength: 1, maxLength: 500, optional: true })
  title?: string;

  @IsString({ optional: true, nullable: true })
  notes?: string | null;

  /** Moving to a done-category status completes it. */
  @IsString({ optional: true })
  statusId?: string;

  @IsEnum({ enum: { TaskPriority }, optional: true })
  priority?: TaskPriority;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  dueDate?: string | null;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  reminderAt?: string | null;

  @IsEnum({ enum: { RepeatType }, optional: true })
  repeat?: RepeatType;

  /** With repeat CUSTOM: "3d", "2w", "6m", "1y". */
  @IsString({
    optional: true,
    nullable: true,
    pattern: { regex: CUSTOM_REPEAT },
  })
  repeatCustom?: string | null;

  @IsNumber({ min: 0, optional: true, nullable: true })
  quantity?: number | null;

  @IsString({ optional: true, nullable: true })
  unit?: string | null;

  @IsString({ optional: true, nullable: true })
  assigneeId?: string | null;

  @IsString({ optional: true, nullable: true })
  parentTaskId?: string | null;
}

/** Drag on the board: into a status column, at a position. */
/** To another project: the inbox's way out, or a task that belongs elsewhere. */
export class MoveTaskToProjectDto {
  @IsString()
  projectId: string;

  /** In the target's workflow; the first status of the same category when omitted. */
  @IsString({ optional: true })
  statusId?: string;
}

export class MoveTaskDto {
  @IsString()
  statusId: string;

  /** 0-based position in the target column; the end when omitted. */
  @IsNumber({ type: 'integer', min: 0, optional: true })
  index?: number;
}

export class ListTasksQueryDto {
  @IsString({ optional: true })
  statusId?: string;

  @IsEnum({ enum: { StatusCategory }, optional: true })
  category?: StatusCategory;

  /** `me` for your own. */
  @IsString({ optional: true })
  assigneeId?: string;

  /** Title or key. */
  @IsString({ optional: true })
  q?: string;

  /** Include subtasks as their own rows. */
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ optional: true })
  withSubtasks?: boolean;
}

export enum MyTasksView {
  /** Due today or overdue. */
  TODAY = 'TODAY',
  /** Due within seven days, overdue included. */
  WEEK = 'WEEK',
  OVERDUE = 'OVERDUE',
  /** Everything open assigned to you, plus your inbox. */
  OPEN = 'OPEN',
}

export class MyTasksQueryDto {
  @IsEnum({ enum: { MyTasksView }, optional: true })
  view?: MyTasksView;
}

export class CreateChecklistItemDto {
  @IsString({ minLength: 1, maxLength: 500 })
  content: string;
}

export class UpdateChecklistItemDto {
  @IsString({ minLength: 1, maxLength: 500, optional: true })
  content?: string;

  /** Ticking needs only check rights; changing the text needs edit rights. */
  @IsBoolean({ optional: true })
  done?: boolean;
}
