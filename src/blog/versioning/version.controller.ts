import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../common/decorators';
import { PERMISSIONS } from '../../common/acl/permissions';
import { VersioningService } from './versioning.service';
import { RollbackDto, ScheduleDto } from './dto';
import { VersionListResponse } from './responses';
import { PostResponse } from '../post/responses';

@Controller('blog/posts')
@ApiTags('Blog · Versioning')
@ApiBearerAuth()
export class VersionController {
  constructor(private readonly versioningService: VersioningService) {}

  @RequirePermissions(PERMISSIONS.BLOG_PUBLISH)
  @Post(':id/publish')
  @ApiOkResponse({ description: 'Published post', type: PostResponse })
  async publish(@Param('id') id: string): Promise<PostResponse> {
    return this.versioningService.publish(id);
  }

  @RequirePermissions(PERMISSIONS.BLOG_PUBLISH)
  @Post(':id/unpublish')
  @ApiOkResponse({ description: 'Unpublished post', type: PostResponse })
  async unpublish(@Param('id') id: string): Promise<PostResponse> {
    return this.versioningService.unpublish(id);
  }

  @RequirePermissions(PERMISSIONS.BLOG_PUBLISH)
  @Post(':id/schedule')
  @ApiOkResponse({ description: 'Scheduled post', type: PostResponse })
  async schedule(
    @Param('id') id: string,
    @Body() dto: ScheduleDto,
  ): Promise<PostResponse> {
    return this.versioningService.schedule(id, dto);
  }

  @RequirePermissions(PERMISSIONS.BLOG_PUBLISH)
  @Post(':id/archive')
  @ApiOkResponse({ description: 'Archived post', type: PostResponse })
  async archive(@Param('id') id: string): Promise<PostResponse> {
    return this.versioningService.archive(id);
  }

  @RequirePermissions(PERMISSIONS.BLOG_PUBLISH)
  @Post(':id/restore')
  @ApiOkResponse({ description: 'Restored post', type: PostResponse })
  async restore(@Param('id') id: string): Promise<PostResponse> {
    return this.versioningService.restore(id);
  }

  @RequirePermissions(PERMISSIONS.BLOG_PUBLISH)
  @Post(':id/rollback')
  @ApiOkResponse({ description: 'Rolled back post', type: PostResponse })
  async rollback(
    @Param('id') id: string,
    @Body() dto: RollbackDto,
  ): Promise<PostResponse> {
    return this.versioningService.rollback(id, dto.versionId);
  }

  @RequirePermissions(PERMISSIONS.BLOG_READ_DRAFT)
  @Get(':id/versions')
  @ApiOkResponse({ description: 'Version history', type: VersionListResponse })
  async listVersions(@Param('id') id: string): Promise<VersionListResponse> {
    return this.versioningService.listVersions(id);
  }

  @RequirePermissions(PERMISSIONS.BLOG_VERSION_PRUNE)
  @Delete(':id/versions/:versionId')
  @ApiOkResponse({
    description: 'Pruned an ARCHIVED version',
    type: VersionListResponse,
  })
  async pruneVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ): Promise<VersionListResponse> {
    return this.versioningService.pruneVersion(id, versionId);
  }
}
