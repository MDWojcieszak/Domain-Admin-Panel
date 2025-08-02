import { IsString, IsObject } from 'nestjs-swagger-dto';

export class AiHistoryCreateDto {
  @IsString()
  aiContextId: string;

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
