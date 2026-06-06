import { IsString, IsNumber, IsObject } from 'nestjs-swagger-dto';
import { AiLogFieldsDto } from './ai-log-fields.dto';

export class AiContextDto extends AiLogFieldsDto {
  @IsString({ optional: true })
  summary?: string;

  @IsObject({ optional: true })
  keywords?: any;

  @IsString({ optional: true })
  context?: string;

  @IsObject({ optional: true })
  aiMeta?: any;

  @IsNumber({ optional: true })
  aiConfidence?: number;

  @IsString({ optional: true })
  aiSource?: string;
}
