import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { PERMISSIONS } from '../../common/acl/permissions';
import { GetCurrentUser, RequirePermissions } from '../../common/decorators';
import { AttentionService } from './attention.service';
import { PhotoEntrySkyResponse } from '../sky/responses';
import { SkyService } from '../sky/sky.service';
import { AttentionResponse } from './responses';

/** Planning views across entries (docs/photo-entry-planning-and-publish.md). */
@ApiTags('Photo Entry')
@ApiBearerAuth()
@Controller('photo-entry')
export class PhotoEntryPlanningController {
  constructor(
    private readonly attention: AttentionService,
    private readonly sky: SkyService,
  ) {}

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

  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_READ)
  @Get(':id/sky')
  @ApiOperation({
    summary: 'Sun, moon, darkness and eclipses for the entry',
    description:
      'Per local day at the entry location: sunrise/sunset, golden and blue ' +
      'hour, twilights, moon phase and rise/set, astronomical darkness with the ' +
      'moonless part and Milky Way core visibility; plus eclipses peaking ' +
      'during the entry. Needs a location and a start date. All times are UTC — ' +
      'display them in `timezone`.',
  })
  @ApiOkResponse({ type: PhotoEntrySkyResponse })
  getSky(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<PhotoEntrySkyResponse> {
    return this.sky.forEntry(userId, id);
  }
}
