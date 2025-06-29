import { SettingType } from '@prisma/client';
import { IsEnum, IsNested, IsString } from 'nestjs-swagger-dto';

class ServerCategory {
  @IsString()
  id: string;

  @IsString()
  name: string;
}

export class ServerSettingsResponseDto {
  @IsString()
  id: string;

  @IsNested({ type: ServerCategory })
  serverCategory: ServerCategory;

  @IsString({ optional: true })
  name?: string;

  @IsString()
  serverName: string;

  @IsString()
  value: string;

  @IsEnum({ enum: { SettingType } })
  type: SettingType;
}
