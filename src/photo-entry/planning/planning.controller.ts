import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { PERMISSIONS } from '../../common/acl/permissions';
import { GetCurrentUser, RequirePermissions } from '../../common/decorators';
import { AttentionService } from './attention.service';
import { AttentionResponse } from './responses';

/** Planning views across entries (docs/photo-entry-planning-and-publish.md). */
@ApiTags('Photo Entry')
@ApiBearerAuth()
@Controller('photo-entry')
export class PhotoEntryPlanningController {
  constructor(private readonly attention: AttentionService) {}

  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_READ)
  @Get('attention')
  @ApiOperation({
    summary: 'What needs a decision',
    description:
      'Planned entries whose dates are over (did it happen?), media past its ' +
      'threshold, undeclared gear, wishlist gear needed within 30 days and open ' +
      'TODOs. All derived on read.',
  })
  @ApiOkResponse({ type: AttentionResponse })
  get(@GetCurrentUser('sub') userId: string): Promise<AttentionResponse> {
    return this.attention.get(userId);
  }
}
