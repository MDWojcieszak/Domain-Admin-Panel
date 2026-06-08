import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../common/decorators';
import { PERMISSIONS } from '../../common/acl/permissions';
import { ReorderDto } from '../section/dto';
import { TemplateService } from './template.service';
import {
  CreateTemplateBlockDto,
  CreateTemplateDto,
  PatchTemplateBlockDto,
  PatchTemplateDto,
} from './dto';
import {
  ApplyTemplateResponse,
  TemplateListResponse,
  TemplateResponse,
} from './responses';

@Controller('blog')
@ApiTags('Blog · Templates')
@ApiBearerAuth()
@RequirePermissions(PERMISSIONS.BLOG_WRITE)
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Get('templates')
  @ApiOkResponse({ description: 'List templates', type: TemplateListResponse })
  async list(): Promise<TemplateListResponse> {
    return this.templateService.list();
  }

  @Post('templates')
  @ApiOkResponse({ description: 'Created template', type: TemplateResponse })
  async create(@Body() dto: CreateTemplateDto): Promise<TemplateResponse> {
    return this.templateService.create(dto);
  }

  @Get('templates/:id')
  @ApiOkResponse({ description: 'Template detail', type: TemplateResponse })
  async get(@Param('id') id: string): Promise<TemplateResponse> {
    return this.templateService.get(id);
  }

  @Patch('templates/:id')
  @ApiOkResponse({ description: 'Patched template', type: TemplateResponse })
  async patch(
    @Param('id') id: string,
    @Body() dto: PatchTemplateDto,
  ): Promise<TemplateResponse> {
    return this.templateService.patch(id, dto);
  }

  @Delete('templates/:id')
  @ApiOkResponse({ description: 'Deleted template', type: TemplateResponse })
  async delete(@Param('id') id: string): Promise<TemplateResponse> {
    return this.templateService.delete(id);
  }

  // ----- blocks -----

  @Post('templates/:id/blocks')
  @ApiOkResponse({ description: 'Added block', type: TemplateResponse })
  async addBlock(
    @Param('id') id: string,
    @Body() dto: CreateTemplateBlockDto,
  ): Promise<TemplateResponse> {
    return this.templateService.addBlock(id, dto);
  }

  @Post('templates/:templateId/blocks/reorder')
  @ApiOkResponse({ description: 'Reordered blocks', type: TemplateResponse })
  async reorderBlocks(
    @Param('templateId') templateId: string,
    @Body() dto: ReorderDto,
  ): Promise<TemplateResponse> {
    return this.templateService.reorderBlocks(templateId, dto);
  }

  @Patch('templates/:templateId/blocks/:blockId')
  @ApiOkResponse({ description: 'Patched block', type: TemplateResponse })
  async patchBlock(
    @Param('templateId') templateId: string,
    @Param('blockId') blockId: string,
    @Body() dto: PatchTemplateBlockDto,
  ): Promise<TemplateResponse> {
    return this.templateService.patchBlock(templateId, blockId, dto);
  }

  @Delete('templates/:templateId/blocks/:blockId')
  @ApiOkResponse({ description: 'Deleted block', type: TemplateResponse })
  async deleteBlock(
    @Param('templateId') templateId: string,
    @Param('blockId') blockId: string,
  ): Promise<TemplateResponse> {
    return this.templateService.deleteBlock(templateId, blockId);
  }

  // ----- apply -----

  @Post('posts/:postId/sections/apply/:templateId')
  @ApiOkResponse({
    description: 'Applied template to the post draft',
    type: ApplyTemplateResponse,
  })
  async apply(
    @Param('postId') postId: string,
    @Param('templateId') templateId: string,
  ): Promise<ApplyTemplateResponse> {
    return this.templateService.applyToPost(postId, templateId);
  }
}
