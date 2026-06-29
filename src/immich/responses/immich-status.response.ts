import { IsBoolean, IsString } from 'nestjs-swagger-dto';

export class ImmichStatusResponse {
  @IsBoolean()
  configured: boolean;

  @IsBoolean()
  connected: boolean;

  @IsString({ optional: true })
  serverVersion?: string;

  @IsString({ optional: true })
  baseUrl?: string;

  @IsString({ optional: true })
  libraryPath?: string;
}
