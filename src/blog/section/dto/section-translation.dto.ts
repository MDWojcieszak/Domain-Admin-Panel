import { IsString } from 'nestjs-swagger-dto';

export class UpsertSectionTranslationDto {
  @IsString({ optional: true, nullable: true })
  title?: string | null;

  @IsString({ optional: true, nullable: true, description: 'Markdown body.' })
  body?: string | null;

  @IsString({ isArray: true, optional: true })
  keywords?: string[];
}
