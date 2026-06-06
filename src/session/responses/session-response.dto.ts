import { IsBoolean, IsDate, IsString } from 'nestjs-swagger-dto';

export class SessionResponseDto {
  @IsString()
  id: string;

  @IsString({ optional: true, nullable: true })
  browser: string | null;

  @IsString({ optional: true, nullable: true })
  os: string | null;

  @IsString({ optional: true, nullable: true })
  platform: string | null;

  @IsBoolean({ optional: true })
  isCurrent?: boolean;

  @IsDate({ format: 'date-time', optional: true })
  createdAt?: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}
