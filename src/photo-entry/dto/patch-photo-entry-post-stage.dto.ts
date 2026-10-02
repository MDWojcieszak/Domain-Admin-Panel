import { PhotoEntryPostStage } from '@prisma/client';
import { IsEnum } from 'nestjs-swagger-dto';

/**
 * The post-processing axis, separate from the entry's status (D1).
 *
 * NONE is a valid destination: moving back means "I am not working on this
 * after all", which is a normal outcome rather than a failure.
 */
export class PatchPhotoEntryPostStageDto {
  @IsEnum({ enum: { PhotoEntryPostStage } })
  postStage: PhotoEntryPostStage;
}
