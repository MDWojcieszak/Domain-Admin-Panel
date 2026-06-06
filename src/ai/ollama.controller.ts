import { Controller, Get, Post, Body, HttpCode } from '@nestjs/common';
import {
  ApiTags,
  ApiOkResponse,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { PullModelDto } from './dto';
import { OllamaClient } from './clients';
import { RequirePermissions } from '../common/decorators';
import { PERMISSIONS } from '../common/acl/permissions';
import {
  OllamaListModelsResponseDto,
  OllamaPullModelResponseDto,
} from './responses';

@ApiTags('AI / Ollama')
@ApiBearerAuth()
@Controller('ai/ollama')
export class OllamaController {
  constructor(private readonly ollama: OllamaClient) {}

  @Get('models')
  @RequirePermissions(PERMISSIONS.AI_MANAGE)
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
  @RequirePermissions(PERMISSIONS.AI_MANAGE)
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
