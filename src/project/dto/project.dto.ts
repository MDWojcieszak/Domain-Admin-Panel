import {
  ProjectRole,
  ProjectStatus,
  ProjectType,
  StatusCategory,
} from '@prisma/client';
import { IsBoolean, IsEnum, IsString } from 'nestjs-swagger-dto';

import { PROJECT_KEY } from '../project-defaults';

export class CreateProjectDto {
  @IsString({ minLength: 1, maxLength: 200 })
  title: string;

  @IsString({ optional: true, nullable: true })
  description?: string | null;

  @IsEnum({ enum: { ProjectType }, optional: true })
  type?: ProjectType;

  @IsEnum({ enum: { ProjectStatus }, optional: true })
  status?: ProjectStatus;

  /** ASTRO; derived from the title when omitted. */
  @IsString({ optional: true, pattern: { regex: PROJECT_KEY } })
  key?: string;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  startDate?: string | null;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  dueDate?: string | null;

  @IsString({ optional: true, nullable: true })
  color?: string | null;

  @IsString({ optional: true, nullable: true })
  icon?: string | null;

  @IsBoolean({ optional: true })
  viewersCanCheck?: boolean;

  /** A trip's shoot; linking one takes photoEntry.read. */
  @IsString({ optional: true, nullable: true })
  photoEntryId?: string | null;
}

export class UpdateProjectDto {
  @IsString({ minLength: 1, maxLength: 200, optional: true })
  title?: string;

  @IsString({ optional: true, nullable: true })
  description?: string | null;

  /** The sections shown change; the data of hidden ones stays (D6). */
  @IsEnum({ enum: { ProjectType }, optional: true })
  type?: ProjectType;

  @IsEnum({ enum: { ProjectStatus }, optional: true })
  status?: ProjectStatus;

  /** Owner only. Task keys follow it: ASTRO-12 becomes NEW-12. */
  @IsString({ optional: true, pattern: { regex: PROJECT_KEY } })
  key?: string;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  startDate?: string | null;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  dueDate?: string | null;

  @IsString({ optional: true, nullable: true })
  color?: string | null;

  @IsString({ optional: true, nullable: true })
  icon?: string | null;

  @IsBoolean({ optional: true })
  viewersCanCheck?: boolean;

  /** A trip's shoot; linking one takes photoEntry.read. */
  @IsString({ optional: true, nullable: true })
  photoEntryId?: string | null;

  @IsBoolean({ optional: true })
  archived?: boolean;
}

export class ListProjectsQueryDto {
  @IsEnum({ enum: { ProjectStatus }, optional: true })
  status?: ProjectStatus;

  @IsEnum({ enum: { ProjectType }, optional: true })
  type?: ProjectType;

  /** Title or key. */
  @IsString({ optional: true })
  q?: string;

  @IsBoolean({ optional: true })
  archived?: boolean;

  /** Templates only, instead of projects. */
  @IsBoolean({ optional: true })
  templates?: boolean;
}

/**
 * A copy to start over with (D12): structure and plans, no ticks, no people,
 * no history. Dates move with the new start.
 */
export class DuplicateProjectDto {
  @IsString({ minLength: 1, maxLength: 200 })
  title: string;

  /** Due dates shift by the distance between the old start and this one. */
  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  startDate?: string | null;

  /** Keep it as a template instead of a working project. */
  @IsBoolean({ optional: true })
  asTemplate?: boolean;
}

export class CreateProjectStatusDto {
  @IsString({ minLength: 1, maxLength: 60 })
  name: string;

  @IsEnum({ enum: { StatusCategory } })
  category: StatusCategory;

  @IsString({ optional: true, nullable: true })
  color?: string | null;
}

export class UpdateProjectStatusDto {
  @IsString({ minLength: 1, maxLength: 60, optional: true })
  name?: string;

  @IsEnum({ enum: { StatusCategory }, optional: true })
  category?: StatusCategory;

  @IsString({ optional: true, nullable: true })
  color?: string | null;
}

export class ReorderIdsDto {
  /** Every id, in the new order. */
  @IsString({ isArray: true })
  ids: string[];
}

export class DeleteProjectStatusDto {
  /** Where its tasks go. */
  @IsString()
  moveToStatusId: string;
}

export class AddProjectMemberDto {
  /** Exact address of an existing account. */
  @IsString({ isEmail: true })
  email: string;

  @IsEnum({ enum: { ProjectRole } })
  role: ProjectRole;
}

export class UpdateProjectMemberDto {
  @IsEnum({ enum: { ProjectRole } })
  role: ProjectRole;
}
