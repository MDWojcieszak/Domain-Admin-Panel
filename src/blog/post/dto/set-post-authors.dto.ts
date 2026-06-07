import { BlogAuthorRole } from '@prisma/client';
import { IsEnum, IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';

export class PostAuthorInputDto {
  @IsString()
  userId: string;

  @IsEnum({ enum: { BlogAuthorRole }, optional: true })
  role?: BlogAuthorRole;

  @IsNumber({ type: 'integer', optional: true })
  order?: number;
}

/**
 * Replaces the post byline. Contract: at least one AUTHOR; one entry per user.
 */
export class SetPostAuthorsDto {
  @IsNested({ type: PostAuthorInputDto, isArray: true })
  authors: PostAuthorInputDto[];
}
