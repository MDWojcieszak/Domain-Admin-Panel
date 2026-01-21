import { IsString } from 'nestjs-swagger-dto';

export class CreateCategoryDto {
  @IsString({ optional: true })
  name?: string;

  @IsString()
  value: string;
}
