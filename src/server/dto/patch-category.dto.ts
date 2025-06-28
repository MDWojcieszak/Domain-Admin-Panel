import { IsString } from 'nestjs-swagger-dto';

export class PatchCategorykDto {
  @IsString({ optional: true })
  name?: string;
}
