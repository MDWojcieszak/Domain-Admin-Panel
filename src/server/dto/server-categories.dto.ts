import { IsString } from 'nestjs-swagger-dto';

export class ServerCategoriesDto {
  @IsString()
  id: string;

  @IsString({ optional: true })
  name?: string;

  @IsString()
  value?: string;
}
