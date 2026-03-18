import { IsString } from 'nestjs-swagger-dto';

export class PatchAstroObjectDto {
  @IsString({ optional: true })
  name?: string;

  @IsString({ optional: true })
  code?: string;

  @IsString({ optional: true })
  thumbnailUrl?: string;
}
