import { IsNumber, IsString } from 'nestjs-swagger-dto';

export class CreateCommentDto {
  @IsString({
    optional: true,
    description: 'Section to anchor to; omit for a post-level thread.',
  })
  sectionId?: string;

  @IsNumber({ type: 'integer', optional: true })
  anchorStart?: number;

  @IsNumber({ type: 'integer', optional: true })
  anchorEnd?: number;

  @IsString({
    optional: true,
    description: 'Cached quote of the anchored text.',
  })
  quote?: string;

  @IsString()
  body: string;
}

export class PatchCommentDto {
  @IsString()
  body: string;
}
