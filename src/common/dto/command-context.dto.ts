import { IsString } from 'nestjs-swagger-dto';

export class CommandContextDto {
  @IsString()
  serverId: string;

  @IsString()
  categoryId: string;

  @IsString()
  userId: string;
}
