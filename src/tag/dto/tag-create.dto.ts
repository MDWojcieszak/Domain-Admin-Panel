import { IsString } from 'nestjs-swagger-dto';

export class TagCreateDto {
  @IsString()
  name: string;

  @IsString({ optional: true })
  color?: string;
}
