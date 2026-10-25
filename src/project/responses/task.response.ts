import { RepeatType, StatusCategory, TaskPriority } from '@prisma/client';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

import { ProjectUserResponse } from './project.response';

export class TaskStatusRefResponse {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString({ optional: true, nullable: true })
  color: string | null;

  @IsEnum({ enum: { StatusCategory } })
  category: StatusCategory;
}

export class TaskProjectRefResponse {
  @IsString()
  id: string;

  @IsString()
  title: string;

  @IsString()
  key: string;

  @IsBoolean()
  isInbox: boolean;
}

export class ChecklistCountResponse {
  @IsNumber({ type: 'integer' })
  total: number;

  @IsNumber({ type: 'integer' })
  done: number;
}

export class ChecklistItemResponse {
  @IsString()
  id: string;

  @IsString()
  content: string;

  @IsBoolean()
  done: boolean;

  @IsNumber({ type: 'integer' })
  order: number;
}

export class TaskResponse {
  @IsString()
  id: string;

  /** ASTRO-12 */
  @IsString()
  key: string;

  @IsNumber({ type: 'integer' })
  number: number;

  @IsNested({ type: TaskProjectRefResponse })
  project: TaskProjectRefResponse;

  @IsString()
  title: string;

  @IsString({ optional: true, nullable: true })
  notes: string | null;

  @IsNested({ type: TaskStatusRefResponse })
  status: TaskStatusRefResponse;

  @IsEnum({ enum: { TaskPriority } })
  priority: TaskPriority;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  dueDate: Date | null;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  reminderAt: Date | null;

  @IsEnum({ enum: { RepeatType } })
  repeat: RepeatType;

  /** Shopping-list items. */
  @IsNumber({ optional: true, nullable: true })
  quantity: number | null;

  @IsString({ optional: true, nullable: true })
  unit: string | null;

  /** Position inside its status column. */
  @IsNumber({ type: 'integer' })
  order: number;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  completedAt: Date | null;

  @IsNested({ type: ProjectUserResponse, optional: true, nullable: true })
  completedBy: ProjectUserResponse | null;

  @IsNested({ type: ProjectUserResponse, optional: true, nullable: true })
  assignee: ProjectUserResponse | null;

  @IsNested({ type: ProjectUserResponse, optional: true, nullable: true })
  createdBy: ProjectUserResponse | null;

  @IsString({ optional: true, nullable: true })
  parentTaskId: string | null;

  @IsNested({ type: ChecklistCountResponse })
  checklist: ChecklistCountResponse;

  @IsNumber({ type: 'integer' })
  subtaskCount: number;

  /** Past its due date and not done — derived, never stored. */
  @IsBoolean()
  overdue: boolean;

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}

export class TaskParentRefResponse {
  @IsString()
  id: string;

  @IsString()
  key: string;

  @IsString()
  title: string;
}

export class TaskDetailResponse extends TaskResponse {
  @IsNested({ type: ChecklistItemResponse, isArray: true })
  checklistItems: ChecklistItemResponse[];

  @IsNested({ type: TaskResponse, isArray: true })
  subtasks: TaskResponse[];

  @IsNested({ type: TaskParentRefResponse, optional: true, nullable: true })
  parent: TaskParentRefResponse | null;
}
