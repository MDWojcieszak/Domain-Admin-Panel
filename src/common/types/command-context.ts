import { IsString } from 'nestjs-swagger-dto';

export class CommandContext {
  @IsString()
  serverId: string;

  @IsString()
  categoryId: string;

  @IsString()
  userId: string;
}
