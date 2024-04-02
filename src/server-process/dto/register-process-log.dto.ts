import { IsEnum, IsString } from 'nestjs-swagger-dto';
import { ProcessLogLevel } from '@prisma/client';
export class RegisterProcessLogDto {
  @IsString()
  processId: string;

  @IsString()
  message: string;

  @IsEnum({ enum: { ProcessLogLevel }, optional: true })
  level?: ProcessLogLevel;
}
