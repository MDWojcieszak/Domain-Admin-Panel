import { ServerProcessStatus } from '@prisma/client';
import { IsEnum, IsString } from 'nestjs-swagger-dto';

export class RegisterProcessDto {
  @IsString()
  categoryId: string;

  @IsString()
  userId: string;

  @IsString()
  name: string;

  @IsEnum({ enum: { ServerProcessStatus }, optional: true })
  status: ServerProcessStatus;
}
