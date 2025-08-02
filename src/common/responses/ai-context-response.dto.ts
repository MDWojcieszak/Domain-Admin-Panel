import { IsString, IsNumber, IsDate, IsObject } from 'nestjs-swagger-dto';

export class AiContextResponseDto {
  @IsString()
  id: string;

  @IsString({ optional: true })
  summary?: string;

  @IsObject({ optional: true })
  keywords?: Object;

  @IsString({ optional: true })
  context?: string;

  @IsObject({ optional: true })
  aiMeta?: Object;

  @IsNumber({ optional: true })
  aiConfidence?: number;

  @IsString({ optional: true })
  aiSource?: string;

  @IsDate({ format: 'date-time', optional: true })
  createdAt?: Date;

  @IsDate({ format: 'date-time', optional: true })
  updatedAt?: Date;
}
