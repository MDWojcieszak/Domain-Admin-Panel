import {
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';

import { Public, Throttle } from '../common/decorators';
import { ThrottleGuard } from '../common/guards/throttle.guard';
import { ProjectShareService } from './project-share.service';
import { SharedProjectResponse } from './responses';

const PASSWORD_HEADER = 'x-share-password';

/**
 * What a public project link opens, without signing in (D3). The token is
 * the only key; a password, when the link has one, comes in a header so it
 * never lands in a URL or a log.
 */
@ApiTags('Shared')
@Public()
@UseGuards(ThrottleGuard)
@Controller('shared')
export class SharedController {
  constructor(private readonly shares: ProjectShareService) {}

  @Get(':token')
  @Throttle(60, 60_000)
  @ApiHeader({ name: PASSWORD_HEADER, required: false })
  @ApiQuery({
    name: 'reload',
    required: false,
    type: Boolean,
    description: 'A refresh after a live change; not counted as a visit.',
  })
  @ApiOkResponse({ type: SharedProjectResponse })
  view(
    @Param('token') token: string,
    @Headers(PASSWORD_HEADER) password?: string,
    @Query('reload') reload?: string,
  ): Promise<SharedProjectResponse> {
    return this.shares.view(token, password, reload !== 'true');
  }

  @Post(':token/tasks/:taskId/toggle')
  @Throttle(120, 60_000)
  @ApiHeader({ name: PASSWORD_HEADER, required: false })
  @ApiOkResponse({ type: SharedProjectResponse })
  toggle(
    @Param('token') token: string,
    @Param('taskId') taskId: string,
    @Headers(PASSWORD_HEADER) password?: string,
  ): Promise<SharedProjectResponse> {
    return this.shares.toggle(token, password, taskId);
  }
}
