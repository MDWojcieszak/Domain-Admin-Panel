import { IsString } from 'nestjs-swagger-dto';

export class ReorderGalleriesDto {
  /** Gallery ids in the desired display order (index becomes sortOrder). */
  @IsString({ isArray: true })
  ids: string[];
}
