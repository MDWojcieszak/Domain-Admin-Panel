import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { Token } from '../common/decorators/token.decorator';
import { GetTokenUser } from '../common/decorators/get-token-user';
import { ApiKeyType } from '@prisma/client';
import { PersonAiService } from './person-ai.service';
import {
  PersonAiListResponseDto,
  PersonAiDetailResponseDto,
} from './responses';
import { PersonAiCreateDto, PersonAiUpdateDto } from './dto';
import {
  AiContextResponseDto,
  AiHistoryListResponseDto,
} from '../common/responses';
import { AiContextDto } from '../common/dto';

@ApiTags('AI - Person')
@Token([ApiKeyType.AI])
@Controller('person/ai')
export class PersonAiController {
  constructor(private readonly personAiService: PersonAiService) {}

  @Get('list')
  @ApiOkResponse({
    type: PersonAiListResponseDto,
    description: 'AI: List persons for the user (with AI context)',
  })
  async listPersonsForAI(
    @GetTokenUser('userId') userId: string,
  ): Promise<PersonAiListResponseDto> {
    return this.personAiService.listPersonsForAI(userId);
  }

  @Get(':id')
  @ApiOkResponse({
    type: PersonAiDetailResponseDto,
    description: 'AI: Get person details (with AI context)',
  })
  async getPersonForAI(
    @GetTokenUser('userId') userId: string,
    @Param('id') id: string,
  ): Promise<PersonAiDetailResponseDto> {
    return this.personAiService.getPersonForAI(userId, id);
  }

  @Post()
  @ApiOkResponse({ type: PersonAiDetailResponseDto })
  async createPerson(
    @GetTokenUser('userId') userId: string,
    @Body() dto: PersonAiCreateDto,
  ): Promise<PersonAiDetailResponseDto> {
    return this.personAiService.createPerson(userId, dto);
  }

  @Put(':id')
  @ApiOkResponse({ type: PersonAiDetailResponseDto })
  async updatePerson(
    @Param('id') id: string,
    @GetTokenUser('userId') userId: string,
    @Body() dto: PersonAiUpdateDto,
  ): Promise<PersonAiDetailResponseDto> {
    return this.personAiService.updatePerson(userId, id, dto);
  }

  @Get(':id/history')
  @ApiOkResponse({ type: AiHistoryListResponseDto })
  async getAiHistory(
    @Param('id') personId: string,
    @GetTokenUser('userId') userId: string,
  ): Promise<AiHistoryListResponseDto> {
    return this.personAiService.getAiHistory(userId, personId);
  }

  @Get(':id/context')
  @ApiOkResponse({ type: AiContextDto })
  async getAiContext(
    @Param('id') personId: string,
    @GetTokenUser('userId') userId: string,
  ): Promise<AiContextResponseDto> {
    return this.personAiService.getAiContext(userId, personId);
  }

  @Put(':id/context')
  @ApiOkResponse({ type: AiContextDto })
  async updateAiContext(
    @Param('id') personId: string,
    @GetTokenUser('userId') userId: string,
    @Body() dto: AiContextDto,
  ): Promise<AiContextResponseDto> {
    return this.personAiService.updateAiContext(userId, personId, dto);
  }
}
