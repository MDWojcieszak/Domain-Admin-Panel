import { IsString } from 'class-validator';

export class PatchServerSettingDto {
  @IsString()
  name: string;
}
