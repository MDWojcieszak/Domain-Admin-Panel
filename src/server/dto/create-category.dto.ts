import { IsString } from 'nestjs-swagger-dto';

export class CreateServerCategoryDto {
  @IsString({ optional: true })
  name?: string;

  @IsString()
  value: string;
}
