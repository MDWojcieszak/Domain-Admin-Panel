import { ServerProcessStatus } from '@prisma/client';
import { IsEnum, IsString } from 'nestjs-swagger-dto';

export class ProcessStatusDto {
  @IsString()
  processId: string;

  @IsEnum({ enum: { ServerProcessStatus } })
  status: ServerProcessStatus;
}
