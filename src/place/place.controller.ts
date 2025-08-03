import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PlaceService } from './place.service';
import {
  PlaceDeleteResponseDto,
  PlaceDetailResponseDto,
  PlaceListResponseDto,
  PlaceMemberListResponseDto,
} from './responses';
import { GetCurrentUser } from '../common/decorators';
import { PaginationDto } from '../common/dto';
import { PlaceAddMemberDto, PlaceCreateDto, PlaceUpdateDto } from './dto';
import { AiHistoryListResponseDto } from '../common/responses';
import { PlaceAiService } from './place-ai.service';

@ApiTags('Place')
@ApiBearerAuth()
@Controller('place')
export class PlaceController {
  constructor(
    private readonly placeService: PlaceService,
    private readonly placeAiService: PlaceAiService,
  ) {}

  @Get('list')
  @ApiOkResponse({
    type: PlaceListResponseDto,
    description: 'List all places for the current user (owner or member)',
  })
  async listPlaces(
    @GetCurrentUser('sub') userId: string,
    @Query() params: PaginationDto,
  ): Promise<PlaceListResponseDto> {
    return this.placeService.listPlaces(userId, params);
  }

  @Get(':id')
  @ApiOkResponse({
    type: PlaceDetailResponseDto,
    description: 'Get place details (with members and location)',
  })
  async getPlace(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<PlaceDetailResponseDto> {
    return this.placeService.getPlace(userId, id);
  }

  @Post()
  @ApiOkResponse({ type: PlaceDetailResponseDto })
  async createPlace(
    @GetCurrentUser('sub') userId: string,
    @Body() dto: PlaceCreateDto,
  ): Promise<PlaceDetailResponseDto> {
    return this.placeService.createPlace(userId, dto);
  }

  @Put(':id')
  @ApiOkResponse({ type: PlaceDetailResponseDto })
  async updatePlace(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: PlaceUpdateDto,
  ): Promise<PlaceDetailResponseDto> {
    return this.placeService.updatePlace(userId, id, dto);
  }

  @Delete(':id')
  @ApiOkResponse({ type: PlaceDetailResponseDto })
  async deletePlace(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<PlaceDeleteResponseDto> {
    return this.placeService.deletePlaceWithFailsafe(userId, id);
  }

  @Get(':id/ai/history')
  @ApiOkResponse({ type: AiHistoryListResponseDto })
  async getPlaceAiHistory(
    @GetCurrentUser('sub') userId: string,
    @Param('id') placeId: string,
  ): Promise<AiHistoryListResponseDto> {
    return this.placeAiService.getAiHistory(userId, placeId);
  }

  @Get(':id/members')
  @ApiOkResponse({
    type: PlaceMemberListResponseDto,
    description: 'List members of a place',
  })
  async listMembers(
    @GetCurrentUser('sub') userId: string,
    @Param('id') placeId: string,
  ): Promise<PlaceMemberListResponseDto> {
    return this.placeService.listMembers(userId, placeId);
  }

  @Post(':id/members')
  @ApiOkResponse({ type: PlaceMemberListResponseDto })
  async addMember(
    @GetCurrentUser('sub') userId: string,
    @Param('id') placeId: string,
    @Body() dto: PlaceAddMemberDto,
  ): Promise<PlaceMemberListResponseDto> {
    return this.placeService.addMember(userId, placeId, dto);
  }

  @Delete(':id/members/:memberId')
  @ApiOkResponse({ type: PlaceMemberListResponseDto })
  async removeMember(
    @GetCurrentUser('sub') userId: string,
    @Param('id') placeId: string,
    @Param('memberId') memberId: string,
  ): Promise<PlaceMemberListResponseDto> {
    return this.placeService.removeMember(userId, placeId, memberId);
  }
}
