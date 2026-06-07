import { IsString } from 'nestjs-swagger-dto';

export class UpsertCategoryTranslationDto {
  @IsString({
    optional: true,
    nullable: true,
    description: 'Localized label; null clears it.',
  })
  label?: string | null;
}
