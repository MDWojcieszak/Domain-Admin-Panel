import { IsString } from 'nestjs-swagger-dto';

export class UpsertCollectionTranslationDto {
  @IsString({ optional: true, nullable: true })
  title?: string | null;

  @IsString({ optional: true, nullable: true })
  description?: string | null;
}
