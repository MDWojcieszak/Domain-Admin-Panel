import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { GetTokenUser, Token } from '../common/decorators';
import { ApiKeyType } from '@prisma/client';
import { PlaceAiDetailResponseDto, PlaceAiListResponseDto } from './responses';
import { PlaceAiCreateDto, PlaceAiUpdateDto } from './dto';
import {
  AiContextResponseDto,
  AiHistoryListResponseDto,
} from '../common/responses';
import { AiContextDto } from '../common/dto';
import { PlaceAiService } from './place-ai.service';

@ApiTags('AI - Place')
@Token([ApiKeyType.AI])
@Controller('place/ai')
export class PlaceAiController {
  constructor(private readonly placeAiService: PlaceAiService) {}

  @Get('list')
  @ApiOkResponse({ type: PlaceAiListResponseDto })
  async listPlaces(
    @GetTokenUser('userId') userId: string,
  ): Promise<PlaceAiListResponseDto> {
    return this.placeAiService.listPlacesForAI(userId);
  }

  @Get(':id')
  @ApiOkResponse({ type: PlaceAiDetailResponseDto })
  async getPlace(
    @GetTokenUser('userId') userId: string,
    @Param('id') id: string,
  ): Promise<PlaceAiDetailResponseDto> {
    return this.placeAiService.getPlaceForAI(userId, id);
  }

  @Post()
  @ApiOkResponse({ type: PlaceAiDetailResponseDto })
  async createPlace(
    @GetTokenUser('userId') userId: string,
    @Body() dto: PlaceAiCreateDto,
  ): Promise<PlaceAiDetailResponseDto> {
    return this.placeAiService.createPlace(userId, dto);
  }

  @Put(':id')
  @ApiOkResponse({ type: PlaceAiDetailResponseDto })
  async updatePlace(
    @GetTokenUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: PlaceAiUpdateDto,
  ): Promise<PlaceAiDetailResponseDto> {
    return this.placeAiService.updatePlace(userId, id, dto);
  }

  @Get(':id/history')
  @ApiOkResponse({ type: AiHistoryListResponseDto })
  async getAiHistory(
    @GetTokenUser('userId') userId: string,
    @Param('id') placeId: string,
  ): Promise<AiHistoryListResponseDto> {
    return this.placeAiService.getAiHistory(userId, placeId);
  }

  @Get(':id/context')
  @ApiOkResponse({ type: AiContextResponseDto })
  async getAiContext(
    @GetTokenUser('userId') userId: string,
    @Param('id') placeId: string,
  ): Promise<AiContextResponseDto> {
    return this.placeAiService.getAiContext(userId, placeId);
  }

  @Put(':id/context')
  @ApiOkResponse({ type: AiContextResponseDto })
  async updateAiContext(
    @GetTokenUser('userId') userId: string,
    @Param('id') placeId: string,
    @Body() dto: AiContextDto,
  ): Promise<AiContextResponseDto> {
    return this.placeAiService.updateAiContext(userId, placeId, dto);
  }
}
