import { IsNumber, IsString } from 'nestjs-swagger-dto';

export class AddSectionListItemDto {
  @IsNumber({ type: 'integer', optional: true })
  order?: number;

  @IsString({
    optional: true,
    description:
      'Locale for the initial content. Defaults to the default locale.',
  })
  locale?: string;

  @IsString({ optional: true })
  content?: string;
}

export class PatchSectionListItemDto {
  @IsNumber({ type: 'integer', optional: true })
  order?: number;
}

export class UpsertSectionListItemTranslationDto {
  @IsString({ optional: true, nullable: true })
  content?: string | null;
}
