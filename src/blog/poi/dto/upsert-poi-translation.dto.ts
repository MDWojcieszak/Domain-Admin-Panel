import { IsString } from 'nestjs-swagger-dto';

export class UpsertPoiTranslationDto {
  @IsString({
    optional: true,
    nullable: true,
    description: 'Localized name override.',
  })
  name?: string | null;

  @IsString({ optional: true, nullable: true })
  description?: string | null;
}
