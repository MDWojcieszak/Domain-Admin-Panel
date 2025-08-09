import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { TagService } from './tag.service';
import { TagCreateDto, TagUpdateDto } from './dto';
import { TagDetailResponseDto, TagListResponseDto } from './responses';
import { GetCurrentUser } from '../common/decorators';

@ApiTags('Tag')
@ApiBearerAuth()
@Controller('tag')
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Get('list')
  @ApiOkResponse({ type: TagListResponseDto })
  async listTags(
    @GetCurrentUser('sub') userId: string,
  ): Promise<TagListResponseDto> {
    return this.tagService.listTags(userId);
  }

  @Post()
  @ApiOkResponse({ type: TagDetailResponseDto })
  async createTag(
    @GetCurrentUser('sub') userId: string,
    @Body() dto: TagCreateDto,
  ): Promise<TagDetailResponseDto> {
    return this.tagService.createTag(userId, dto);
  }

  @Put(':id')
  @ApiOkResponse({ type: TagDetailResponseDto })
  async updateTag(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: TagUpdateDto,
  ): Promise<TagDetailResponseDto> {
    return this.tagService.updateTag(userId, id, dto);
  }

  @Delete(':id')
  @ApiOkResponse({ type: TagDetailResponseDto })
  async deleteTag(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<TagDetailResponseDto> {
    return this.tagService.deleteTag(userId, id);
  }
}
