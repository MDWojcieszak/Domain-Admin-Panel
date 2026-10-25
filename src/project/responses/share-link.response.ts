import {
  ProjectStatus,
  ProjectType,
  ShareLinkAccess,
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

import {
  ProjectProgressResponse,
  ProjectUserResponse,
} from './project.response';

/** A link as its owner sees it; the token is never shown again (I3). */
export class ShareLinkResponse {
  @IsString()
  id: string;

  @IsString({ optional: true, nullable: true })
  label: string | null;

  @IsEnum({ enum: { ShareLinkAccess } })
  access: ShareLinkAccess;

  @IsBoolean()
  hasPassword: boolean;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  expiresAt: Date | null;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  revokedAt: Date | null;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  lastUsedAt: Date | null;

  @IsNumber({ type: 'integer' })
  openCount: number;

  /** Neither revoked nor expired. */
  @IsBoolean()
  active: boolean;

  @IsNested({ type: ProjectUserResponse })
  createdBy: ProjectUserResponse;

  @IsDate({ format: 'date-time' })
  createdAt: Date;
}

/** Returned once, on creation: the only time the token exists outside the holder's hands. */
export class CreatedShareLinkResponse extends ShareLinkResponse {
  @IsString()
  token: string;
}

export class SharedStatusResponse {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString({ optional: true, nullable: true })
  color: string | null;

  @IsEnum({ enum: { StatusCategory } })
  category: StatusCategory;
}

export class SharedChecklistItemResponse {
  @IsString()
  content: string;

  @IsBoolean()
  done: boolean;
}

/** A task as a link shows it: no people, nothing to edit. */
export class SharedTaskResponse {
  @IsString()
  id: string;

  @IsString()
  key: string;

  @IsString()
  title: string;

  @IsString({ optional: true, nullable: true })
  notes: string | null;

  @IsString()
  statusId: string;

  @IsNumber({ optional: true, nullable: true })
  quantity: number | null;

  @IsString({ optional: true, nullable: true })
  unit: string | null;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  dueDate: Date | null;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  completedAt: Date | null;

  @IsString({ optional: true, nullable: true })
  parentTaskId: string | null;

  @IsNested({ type: SharedChecklistItemResponse, isArray: true })
  checklist: SharedChecklistItemResponse[];
}

/** The project behind a public link (D3): its tasks, without members or anyone's e-mail. */
export class SharedProjectResponse {
  @IsString()
  title: string;

  @IsString({ optional: true, nullable: true })
  description: string | null;

  @IsEnum({ enum: { ProjectType } })
  type: ProjectType;

  @IsEnum({ enum: { ProjectStatus } })
  status: ProjectStatus;

  @IsString()
  key: string;

  @IsString({ optional: true, nullable: true })
  color: string | null;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  dueDate: Date | null;

  /** First name of whoever shared it, or nothing. */
  @IsString({ optional: true, nullable: true })
  sharedBy: string | null;

  @IsString({ optional: true, nullable: true })
  label: string | null;

  @IsEnum({ enum: { ShareLinkAccess } })
  access: ShareLinkAccess;

  @IsNested({ type: ProjectProgressResponse })
  progress: ProjectProgressResponse;

  @IsNested({ type: SharedStatusResponse, isArray: true })
  statuses: SharedStatusResponse[];

  @IsNested({ type: SharedTaskResponse, isArray: true })
  tasks: SharedTaskResponse[];

  /**
   * Opens the live feed: pass it as `auth.shareToken` on the socket. Short
   * lived, and dropped the moment the link is revoked.
   */
  @IsString()
  liveToken: string;
}
