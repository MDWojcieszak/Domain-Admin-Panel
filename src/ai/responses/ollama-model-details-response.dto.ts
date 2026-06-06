import { IsString } from 'nestjs-swagger-dto';

export class OllamaModelDetailsResponseDto {
  @IsString({
    description: 'Parent model tag if present, otherwise empty string',
    example: '',
    optional: true,
  })
  parent_model?: string;

  @IsString({
    description: 'On-disk format of the model',
    example: 'gguf',
  })
  format: string;

  @IsString({
    description: 'Primary model family',
    example: 'llama',
  })
  family: string;

  @IsString({
    description: 'All families this model belongs to',
    example: ['llama'],
    isArray: true,
  })
  families: string[];

  @IsString({
    description: 'Human-readable parameter size',
    example: '3.2B',
  })
  parameter_size: string;

  @IsString({
    description: 'Quantization level used for the model',
    example: 'Q4_K_M',
  })
  quantization_level: string;
}
