import { IsNested, IsNumber } from 'nestjs-swagger-dto';
import { OllamaModelResponseDto } from './ollama-model-response.dto';

export class OllamaListModelsResponseDto {
  @IsNested({ type: OllamaModelResponseDto, isArray: true })
  models: OllamaModelResponseDto[];

  @IsNumber({ type: 'integer' })
  total: number;
}
