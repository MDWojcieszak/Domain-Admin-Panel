import {
  IsDate,
  IsEnum,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

import { GearItemAdminResponse } from '../../gear/responses';
import { CommentStage } from '../comments/photo-entry-comment-rules';
import {
  PendingMediaEntryResponse,
  UndeclaredEntryResponse,
} from '../gear/responses';

/** A PLANNED entry whose dates are over: did it happen? (§6) */
export class PastPlannedEntryResponse {
  @IsString()
  photoEntryId: string;

  @IsString()
  name: string;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  startDate: Date | null;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  endDate: Date | null;

  /** Whole days since the entry ended. */
  @IsNumber({ type: 'integer' })
  daysOver: number;
}

export class OpenTodoResponse {
  @IsString()
  commentId: string;

  @IsString()
  body: string;

  @IsString()
  photoEntryId: string;

  @IsString()
  entryName: string;

  @IsEnum({ enum: { CommentStage } })
  stage: CommentStage;

  @IsDate({ format: 'date-time' })
  createdAt: Date;
}

export class AttentionCountsResponse {
  @IsNumber({ type: 'integer' })
  pastPlanned: number;

  @IsNumber({ type: 'integer' })
  unsecuredOverdue: number;

  @IsNumber({ type: 'integer' })
  undeclared: number;

  @IsNumber({ type: 'integer' })
  wishlistDueSoon: number;

  @IsNumber({ type: 'integer' })
  openTodos: number;
}

/** Everything that needs a decision, for the dashboard (§6). All derived. */
export class AttentionResponse {
  /** PLANNED but over — mark SHOT or cancel. Oldest first. */
  @IsNested({ type: PastPlannedEntryResponse, isArray: true })
  pastPlanned: PastPlannedEntryResponse[];

  /** Media past its source threshold, most urgent first. */
  @IsNested({ type: PendingMediaEntryResponse, isArray: true })
  unsecuredOverdue: PendingMediaEntryResponse[];

  @IsNested({ type: UndeclaredEntryResponse, isArray: true })
  undeclared: UndeclaredEntryResponse[];

  /** Wishlist gear needed within 30 days, soonest first. */
  @IsNested({ type: GearItemAdminResponse, isArray: true })
  wishlistDueSoon: GearItemAdminResponse[];

  /** Oldest first — the longest-forgotten first. */
  @IsNested({ type: OpenTodoResponse, isArray: true })
  openTodos: OpenTodoResponse[];

  @IsNested({ type: AttentionCountsResponse })
  counts: AttentionCountsResponse;
}
