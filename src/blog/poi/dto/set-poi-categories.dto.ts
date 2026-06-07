import { IsString } from 'nestjs-swagger-dto';

/** Replaces the whole category set (must be ATTRACTION categories; [] clears). */
export class SetPoiCategoriesDto {
  @IsString({ isArray: true })
  categoryIds: string[];
}
