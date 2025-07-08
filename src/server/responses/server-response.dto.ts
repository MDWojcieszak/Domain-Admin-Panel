import { IsDate, IsString } from 'nestjs-swagger-dto';

export class ServerResponseDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  ipAddress: string;

  @IsString({ optional: true })
  macAddress?: string;

  @IsString({ optional: true })
  location: string;

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}
