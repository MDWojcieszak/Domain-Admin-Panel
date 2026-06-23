import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import {
  GetCurrentUser,
  GetOptionalUser,
  Public,
  RequirePermissions,
} from '../../common/decorators';
import { OptionalAuthGuard } from '../../common/guards';
import { PERMISSIONS } from '../../common/acl/permissions';
import { InteractionService } from './interaction.service';
import { InsightsQueryDto, UpsertFeedbackDto } from './dto';
import {
  FeedbackResponse,
  InsightsResponse,
  InteractionStateResponse,
  LikeToggleResponse,
  ViewResultResponse,
} from './responses';

@Controller('blog/posts')
@ApiTags('Blog · Interactions')
@ApiBearerAuth()
export class InteractionController {
  constructor(private readonly interactionService: InteractionService) {}

  // ----- public (no auth; optional token attributes a logged-in viewer) -----

  @Public()
  @UseGuards(OptionalAuthGuard)
  @Post('public/:postId/view')
  @ApiOkResponse({
    description: 'Register a public post view',
    type: ViewResultResponse,
  })
  async viewPublic(
    @Param('postId') postId: string,
    @GetOptionalUser('sub') userId: string | null,
  ): Promise<ViewResultResponse> {
    return this.interactionService.viewPublic(postId, userId);
  }

  // ----- staff -----

  @RequirePermissions(PERMISSIONS.BLOG_READ)
  @Post(':postId/like')
  @ApiOkResponse({ description: 'Liked the post', type: LikeToggleResponse })
  async like(
    @Param('postId') postId: string,
    @GetCurrentUser('sub') userId: string,
  ): Promise<LikeToggleResponse> {
    return this.interactionService.like(postId, userId);
  }

  @RequirePermissions(PERMISSIONS.BLOG_READ)
  @Delete(':postId/like')
  @ApiOkResponse({ description: 'Unliked the post', type: LikeToggleResponse })
  async unlike(
    @Param('postId') postId: string,
    @GetCurrentUser('sub') userId: string,
  ): Promise<LikeToggleResponse> {
    return this.interactionService.unlike(postId, userId);
  }

  @RequirePermissions(PERMISSIONS.BLOG_READ)
  @Post(':postId/view')
  @ApiOkResponse({ description: 'Recorded a view', type: ViewResultResponse })
  async view(
    @Param('postId') postId: string,
    @GetCurrentUser('sub') userId: string,
  ): Promise<ViewResultResponse> {
    return this.interactionService.view(postId, userId);
  }

  @RequirePermissions(PERMISSIONS.BLOG_READ)
  @Get(':postId/interactions')
  @ApiOkResponse({
    description: 'Viewer engagement state + counters',
    type: InteractionStateResponse,
  })
  async interactions(
    @Param('postId') postId: string,
    @GetCurrentUser('sub') userId: string,
  ): Promise<InteractionStateResponse> {
    return this.interactionService.getInteractions(postId, userId);
  }

  @RequirePermissions(PERMISSIONS.BLOG_READ)
  @Put(':postId/feedback')
  @ApiOkResponse({ description: 'Upserted feedback', type: FeedbackResponse })
  async upsertFeedback(
    @Param('postId') postId: string,
    @GetCurrentUser('sub') userId: string,
    @Body() dto: UpsertFeedbackDto,
  ): Promise<FeedbackResponse> {
    return this.interactionService.upsertFeedback(postId, userId, dto);
  }

  @RequirePermissions(PERMISSIONS.BLOG_READ)
  @Delete(':postId/feedback')
  @ApiOkResponse({ description: 'Deleted feedback', type: FeedbackResponse })
  async deleteFeedback(
    @Param('postId') postId: string,
    @GetCurrentUser('sub') userId: string,
  ): Promise<FeedbackResponse> {
    return this.interactionService.deleteFeedback(postId, userId);
  }

  @RequirePermissions(PERMISSIONS.BLOG_ANALYTICS)
  @Get(':postId/insights')
  @ApiOkResponse({
    description: 'Post analytics (staff)',
    type: InsightsResponse,
  })
  async insights(
    @Param('postId') postId: string,
    @Query() query: InsightsQueryDto,
  ): Promise<InsightsResponse> {
    return this.interactionService.getInsights(postId, query);
  }
}
