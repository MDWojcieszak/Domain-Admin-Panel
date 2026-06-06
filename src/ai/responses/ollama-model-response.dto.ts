import { IsString, IsNumber, IsNested } from 'nestjs-swagger-dto';
import { OllamaModelDetailsResponseDto } from './ollama-model-details-response.dto';

export class OllamaModelResponseDto {
  @IsString({
    description: 'Model tag/name as shown by Ollama',
    example: 'llama3.2:latest',
  })
  name: string;

  @IsString({
    description: 'Full model identifier (often same as name)',
    example: 'llama3.2:latest',
  })
  model: string;

  @IsString({
    description: 'Last modification timestamp in ISO 8601',
    example: '2025-07-19T11:08:06.399820654Z',
  })
  modified_at: string;

  @IsNumber({
    description: 'Model size in bytes',
    example: 2019393189,
  })
  size: number;

  @IsString({
    description: 'SHA256 digest of the model',
    example: 'a80c4f17acd55265feec403c7aef86be0c25983ab279d83f3bcd3abbcb5b8b72',
  })
  digest: string;

  @IsNested({
    type: OllamaModelDetailsResponseDto,
    description: 'Additional model metadata',
    example: {
      parent_model: '',
      format: 'gguf',
      family: 'llama',
      families: ['llama'],
      parameter_size: '3.2B',
      quantization_level: 'Q4_K_M',
    },
  })
  details: OllamaModelDetailsResponseDto;
}
