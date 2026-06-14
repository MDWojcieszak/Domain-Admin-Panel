import { IsString } from 'nestjs-swagger-dto';

export class UpsertCountryTranslationDto {
  @IsString()
  name: string;

  @IsString({ optional: true, nullable: true })
  intro?: string | null;
}
