import { IsString } from 'nestjs-swagger-dto';

export class PatchServerCategoryDto {
  @IsString({ optional: true })
  name?: string;
}
