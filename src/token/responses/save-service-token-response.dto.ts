import { IsString, IsDate, IsObject } from 'nestjs-swagger-dto';

export class SaveServiceTokenResponseDto {
  @IsString({ example: 'f7a3d2b1-4e60-4379-a7ef-bdfd1234a789' })
  id: string;

  @IsString({ example: 'telegram' })
  service: string;

  @IsString({ example: 'Oliwia Telegram Token' })
  name: string;

  @IsString({ example: 'EXTERNAL' })
  type: string;

  @IsDate({ format: 'date-time', optional: true })
  expiresAt?: Date;

  @IsDate({ format: 'date-time', optional: true })
  createdAt: Date;

  @IsDate({ format: 'date-time', optional: true })
  updatedAt: Date;

  @IsObject({ optional: true })
  meta?: any;
}
