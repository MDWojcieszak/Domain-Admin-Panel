import { IsString } from 'nestjs-swagger-dto';

export class TagUpdateDto {
  @IsString({ optional: true })
  name?: string;

  @IsString({ optional: true })
  color?: string;
}
