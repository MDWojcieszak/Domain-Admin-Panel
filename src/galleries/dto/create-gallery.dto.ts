import { IsString } from 'nestjs-swagger-dto';

export class CreateGalleryDto {
  @IsString({ minLength: 1, maxLength: 200, example: 'Komunie' })
  title: string;

  @IsString({ optional: true, maxLength: 2000 })
  description?: string;

  /** Optional URL slug; derived from the title when omitted. */
  @IsString({ optional: true, maxLength: 200, example: 'komunie' })
  slug?: string;
}
