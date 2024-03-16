import { IsString } from 'nestjs-swagger-dto';

export class GetServerCommandsDto {
  @IsString()
  serverId: string;

  @IsString({ optional: true })
  categoryId?: string;
}
