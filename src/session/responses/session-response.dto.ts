import { IsDate, IsString } from 'nestjs-swagger-dto';

export class SessionResponseDto {
  @IsString()
  id: string;

  @IsString()
  browser: string;

  @IsString()
  os: string;

  @IsString()
  platform: string;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}
