import { IsString } from 'nestjs-swagger-dto';

export class PatchServerSettingDto {
  @IsString()
  name: string;

  @IsString({ optional: true })
  value?: string;
}
