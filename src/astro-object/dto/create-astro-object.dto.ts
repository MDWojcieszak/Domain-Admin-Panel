import { IsString } from 'nestjs-swagger-dto';

export class CreateAstroObjectDto {
  @IsString()
  name: string;

  @IsString({ optional: true })
  code?: string;

  @IsString({ optional: true })
  thumbnailUrl?: string;
}
