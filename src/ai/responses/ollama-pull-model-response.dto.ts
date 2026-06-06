import { IsNumber, IsString } from 'nestjs-swagger-dto';

export class OllamaPullModelResponseDto {
  @IsString({
    description: 'Current status of the model pull process',
    example: 'downloading',
    optional: true,
  })
  status?: string;

  @IsString({
    description: 'Name of the model being pulled',
    example: 'llama3.2:latest',
    optional: true,
  })
  model?: string;

  @IsString({
    description: 'Unique digest (hash) of the pulled model',
    example: 'a80c4f17acd55265feec403c7aef86be0c25983ab279d83f3bcd3abbcb5b8b72',
    optional: true,
  })
  digest?: string;

  @IsNumber({
    type: 'integer',
    description: 'Total size of the model to be downloaded in bytes',
    example: 2019393189,
    optional: true,
  })
  total?: number;

  @IsNumber({
    type: 'integer',
    description: 'Number of bytes already downloaded',
    example: 1048576000,
    optional: true,
  })
  completed?: number;

  @IsString({
    description: 'Error message if the pull process failed',
    example: 'Failed to download model due to network error',
    optional: true,
  })
  error?: string;
}
