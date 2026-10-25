import {
  ProjectRole,
  ProjectStatus,
  ProjectType,
  StatusCategory,
} from '@prisma/client';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

/** The shoot a trip is for: name and dates, nothing behind photoEntry.read. */
export class ProjectPhotoEntryResponse {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  startDate: Date | null;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  endDate: Date | null;
}

/** Just enough of an account to show who is who. */
export class ProjectUserResponse {
  @IsString()
  id: string;

  @IsString()
  email: string;

  @IsString({ optional: true, nullable: true })
  firstName: string | null;

  @IsString({ optional: true, nullable: true })
  lastName: string | null;
}

export class ProjectStatusResponse {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString({ optional: true, nullable: true })
  color: string | null;

  /** What the status means; all logic follows the category, not the name. */
  @IsEnum({ enum: { StatusCategory } })
  category: StatusCategory;

  @IsNumber({ type: 'integer' })
  order: number;

  /** Top-level tasks currently in this status. */
  @IsNumber({ type: 'integer' })
  taskCount: number;
}

/** Derived from the tasks, never stored (I5). Subtasks are not counted. */
export class ProjectProgressResponse {
  @IsNumber({ type: 'integer' })
  total: number;

  @IsNumber({ type: 'integer' })
  todo: number;

  @IsNumber({ type: 'integer' })
  inProgress: number;

  @IsNumber({ type: 'integer' })
  done: number;

  /** Past their due date and not done. */
  @IsNumber({ type: 'integer' })
  overdue: number;
}

export class ProjectMemberResponse {
  @IsNested({ type: ProjectUserResponse })
  user: ProjectUserResponse;

  @IsEnum({ enum: { ProjectRole } })
  role: ProjectRole;

  @IsDate({ format: 'date-time' })
  createdAt: Date;
}

export class ProjectSummaryResponse {
  @IsString()
  id: string;

  @IsString()
  title: string;

  @IsString({ optional: true, nullable: true })
  description: string | null;

  @IsEnum({ enum: { ProjectType } })
  type: ProjectType;

  @IsEnum({ enum: { ProjectStatus } })
  status: ProjectStatus;

  /** Prefix of task keys: ASTRO → ASTRO-12. */
  @IsString()
  key: string;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  startDate: Date | null;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  dueDate: Date | null;

  @IsString({ optional: true, nullable: true })
  color: string | null;

  @IsString({ optional: true, nullable: true })
  icon: string | null;

  /** The personal inbox: cannot be deleted or shared. */
  @IsBoolean()
  isInbox: boolean;

  @IsBoolean()
  isTemplate: boolean;

  @IsBoolean()
  viewersCanCheck: boolean;

  @IsNested({ type: ProjectPhotoEntryResponse, optional: true, nullable: true })
  photoEntry: ProjectPhotoEntryResponse | null;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  archivedAt: Date | null;

  /** Your role in it. */
  @IsEnum({ enum: { ProjectRole } })
  role: ProjectRole;

  @IsNested({ type: ProjectUserResponse })
  owner: ProjectUserResponse;

  /** People besides the owner. */
  @IsNumber({ type: 'integer' })
  memberCount: number;

  @IsNested({ type: ProjectProgressResponse })
  progress: ProjectProgressResponse;

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}

export class ProjectDetailResponse extends ProjectSummaryResponse {
  /** The workflow, in board order. */
  @IsNested({ type: ProjectStatusResponse, isArray: true })
  statuses: ProjectStatusResponse[];

  @IsNested({ type: ProjectMemberResponse, isArray: true })
  members: ProjectMemberResponse[];
}

export class DuplicateProjectResponse {
  @IsNested({ type: ProjectDetailResponse })
  project: ProjectDetailResponse;

  /**
   * Documents left out of the copy: pinned by someone else, they are theirs
   * to pin again (D8).
   */
  @IsNumber({ type: 'integer' })
  skippedDocuments: number;
}
