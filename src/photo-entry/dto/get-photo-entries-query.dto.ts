import {
  PhotoEntryPostStage,
  PhotoEntryStatus,
  PhotoEntryType,
} from '@prisma/client';
import { IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

export class GetPhotoEntriesQueryDto {
  @IsEnum({ enum: { PhotoEntryType }, optional: true })
  type?: PhotoEntryType;

  @IsEnum({ enum: { PhotoEntryStatus }, optional: true })
  status?: PhotoEntryStatus;

  /**
   * The two axes filter independently (D1) — `status=SHOT&postStage=NONE` is
   * the resting pile, `postStage=EDITING` is what is actually in progress.
   */
  @IsEnum({ enum: { PhotoEntryPostStage }, optional: true })
  postStage?: PhotoEntryPostStage;

  @IsString({ optional: true })
  astroObjectId?: string;

  @IsString({ optional: true })
  search?: string;

  @IsNumber({ type: 'integer', optional: true })
  take?: number;

  @IsNumber({ type: 'integer', optional: true })
  skip?: number;
}
