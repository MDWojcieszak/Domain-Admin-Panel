import {
  PhotoEntryCommentKind,
  PhotoEntryPostStage,
  PhotoEntryStatus,
} from '@prisma/client';
import {
  IsDate,
  IsEnum,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

import { CommentStage } from './photo-entry-comment-rules';

export class PhotoEntryCommentResponse {
  @IsString()
  id: string;

  @IsString()
  photoEntryId: string;

  @IsEnum({ enum: { PhotoEntryCommentKind } })
  kind: PhotoEntryCommentKind;

  @IsString()
  body: string;

  /** Both axes as they were when the comment was written (P8). */
  @IsEnum({ enum: { PhotoEntryStatus } })
  atStatus: PhotoEntryStatus;

  @IsEnum({ enum: { PhotoEntryPostStage } })
  atPostStage: PhotoEntryPostStage;

  /** The readable group derived from the two axes above. */
  @IsEnum({ enum: { CommentStage } })
  stage: CommentStage;

  /** TODO only; null while open (P9). */
  @IsDate({ format: 'date-time', optional: true, nullable: true })
  resolvedAt: Date | null;

  @IsString()
  authorId: string;

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}

export class PhotoEntryCommentGroupResponse {
  @IsEnum({ enum: { CommentStage } })
  stage: CommentStage;

  /** Oldest first within the stage. */
  @IsNested({ type: PhotoEntryCommentResponse, isArray: true })
  comments: PhotoEntryCommentResponse[];
}

export class PhotoEntryCommentListResponse {
  @IsString()
  photoEntryId: string;

  /** The stage a new comment would be pinned to right now. */
  @IsEnum({ enum: { CommentStage } })
  currentStage: CommentStage;

  /** Non-empty stages only, in chronological order. */
  @IsNested({ type: PhotoEntryCommentGroupResponse, isArray: true })
  groups: PhotoEntryCommentGroupResponse[];
}

/** Per-entry counts for list views: open TODOs and highlights at a glance. */
export class PhotoEntryCommentSummaryResponse {
  @IsNumber({ type: 'integer' })
  openTodos: number;

  /** "There is a great shot in here" — counted from HIGHLIGHT comments. */
  @IsNumber({ type: 'integer' })
  highlights: number;

  @IsNumber({ type: 'integer' })
  problems: number;

  @IsNumber({ type: 'integer' })
  total: number;
}
