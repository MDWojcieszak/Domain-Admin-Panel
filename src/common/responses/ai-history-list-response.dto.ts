import { IsNested, IsNumber } from 'nestjs-swagger-dto';
import { AiHistoryResponseDto } from './ai-history-response.dto';

export class AiHistoryListResponseDto {
  @IsNested({ type: AiHistoryResponseDto, isArray: true })
  entries: AiHistoryResponseDto[];

  @IsNumber()
  total: number;
}
