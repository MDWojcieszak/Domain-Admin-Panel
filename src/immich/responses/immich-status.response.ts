import { IsBoolean, IsString } from 'nestjs-swagger-dto';

export class ImmichStatusResponse {
  @IsBoolean()
  connected: boolean;

  @IsString({ optional: true })
  serverVersion?: string;

  @IsString({ optional: true })
  baseUrl?: string;
}
