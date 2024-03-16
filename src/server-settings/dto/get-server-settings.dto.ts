import { IsString } from 'nestjs-swagger-dto';

export class GetServerSettingsDto {
  @IsString()
  serverId: string;

  @IsString({ optional: true })
  categoryId?: string;
}
