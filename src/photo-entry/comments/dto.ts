import { PhotoEntryCommentKind } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsString } from 'nestjs-swagger-dto';

import { toBoolean } from '../../common/helpers/cast.helper';

/**
 * The stage is NOT part of the request: it is stamped server-side from the
 * entry's current status and postStage, and never changes afterwards (P8).
 */
export class CreatePhotoEntryCommentDto {
  @IsEnum({ enum: { PhotoEntryCommentKind }, optional: true })
  kind?: PhotoEntryCommentKind;

  @IsString({ minLength: 1, maxLength: 5000 })
  body: string;
}

/** Body and kind only — the stage a comment was written at is immutable. */
export class PatchPhotoEntryCommentDto {
  /** Changing a TODO into another kind drops its resolution (P9). */
  @IsEnum({ enum: { PhotoEntryCommentKind }, optional: true })
  kind?: PhotoEntryCommentKind;

  @IsString({ minLength: 1, maxLength: 5000, optional: true })
  body?: string;
}

export class GetPhotoEntryCommentsQueryDto {
  /** Only TODOs not yet resolved — "what is still left on this entry". */
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ optional: true })
  unresolved?: boolean;

  @IsEnum({ enum: { PhotoEntryCommentKind }, optional: true })
  kind?: PhotoEntryCommentKind;
}
