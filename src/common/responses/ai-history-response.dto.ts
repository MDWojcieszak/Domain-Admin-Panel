import { IsString, IsDate, IsObject } from 'nestjs-swagger-dto';

export class AiHistoryResponseDto {
  @IsString()
  id: string;

  @IsString()
  aiContextId: string;

  @IsDate({ format: 'date-time' })
  timestamp: Date;

  @IsString()
  action: string;

  @IsString({ optional: true })
  source?: string;

  @IsString({ optional: true })
  userPrompt?: string;

  @IsString({ optional: true })
  aiResponse?: string;

  @IsString({ optional: true })
  text?: string;

  @IsObject({ optional: true })
  meta?: any;
}
