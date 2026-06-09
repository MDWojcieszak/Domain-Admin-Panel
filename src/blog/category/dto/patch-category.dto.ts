import { IsNumber, IsString } from 'nestjs-swagger-dto';

/** Patches neutral fields. `kind` and `isSystem` are immutable (absent here). */
export class PatchBlogCategoryDto {
  @IsString({ optional: true, description: 'Blocked for system categories.' })
  key?: string;

  @IsString({ optional: true, nullable: true })
  icon?: string | null;

  @IsString({ optional: true, nullable: true })
  color?: string | null;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  order?: number | null;
}
