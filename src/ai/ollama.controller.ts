import { Controller, Get, Post, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOkResponse, ApiOperation } from '@nestjs/swagger';

import { PullModelDto } from './dto';
import { OllamaClient } from './clients';
import { Public } from '../common/decorators';
import {
  OllamaListModelsResponseDto,
  OllamaPullModelResponseDto,
} from './responses';

@ApiTags('AI / Ollama')
@Controller('ai/ollama')
export class OllamaController {
  constructor(private readonly ollama: OllamaClient) {}

  @Get('models')
  @Public()
  @ApiOperation({ summary: 'List of locally available models at Ollama' })
  @ApiOkResponse({
    description: 'Model array',
    type: OllamaListModelsResponseDto,
  })
  async listModels(): Promise<OllamaListModelsResponseDto> {
    return this.ollama.listModels();
  }

  @Post('models/pull')
  @HttpCode(200)
  @Public()
  @ApiOperation({
    summary: 'Download the model to your local Ollama repo (pull)',
  })
  @ApiOkResponse({
    description: 'Model download status',
    type: OllamaPullModelResponseDto,
  })
  async pull(@Body() dto: PullModelDto): Promise<OllamaPullModelResponseDto> {
    return this.ollama.pullModel(dto.model);
  }
}
