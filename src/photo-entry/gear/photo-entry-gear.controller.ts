import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { PERMISSIONS } from '../../common/acl/permissions';
import { GetCurrentUser, RequirePermissions } from '../../common/decorators';
import {
  AddPhotoEntryGearDto,
  PatchPhotoEntryGearDto,
  PutPhotoEntryGearDto,
} from './dto';
import { PhotoEntryGearService } from './photo-entry-gear.service';
import {
  PendingMediaResponse,
  PhotoEntryGearListResponse,
  PhotoEntryShoppingListResponse,
} from './responses';

/**
 * Gear per entry (docs/photo-entry-redesign.md D4, §4–§6). Every route answers
 * with the whole list, so the checklist re-renders from one response.
 */
@ApiTags('Photo Entry')
@ApiBearerAuth()
@Controller('photo-entry')
export class PhotoEntryGearController {
  constructor(private readonly gear: PhotoEntryGearService) {}

  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_READ)
  @Get('pending-media')
  @ApiOperation({
    summary: 'Media still waiting to be secured',
    description:
      '`unsecured`: declared gear with media not yet offloaded/scanned/copied, ' +
      'with per-source thresholds (cards 7 days, film 90). `undeclared`: SHOT ' +
      'entries whose gear was never declared — unknown, never emailed about.',
  })
  @ApiOkResponse({ type: PendingMediaResponse })
  pendingMedia(
    @GetCurrentUser('sub') userId: string,
  ): Promise<PendingMediaResponse> {
    return this.gear.pendingMedia(userId);
  }

  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_READ)
  @Get(':id/gear')
  @ApiOperation({
    summary: 'Gear list of an entry',
    description:
      'One list, read by phase: PACK before the shoot, SECURE after it. ' +
      '`listed` marks the rows that belong on the list for the current phase.',
  })
  @ApiOkResponse({ type: PhotoEntryGearListResponse })
  list(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<PhotoEntryGearListResponse> {
    return this.gear.list(userId, id);
  }

  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_READ)
  @Get(':id/shopping-list')
  @ApiOkResponse({
    description: 'Wishlist gear attached to the entry, with the total',
    type: PhotoEntryShoppingListResponse,
  })
  shoppingList(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<PhotoEntryShoppingListResponse> {
    return this.gear.shoppingList(userId, id);
  }

  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_MANAGE)
  @Put(':id/gear')
  @ApiOperation({
    summary: 'Replace the gear list',
    description:
      'Rows missing from `items` are removed; omitted flags on existing rows are left alone.',
  })
  @ApiOkResponse({ type: PhotoEntryGearListResponse })
  replace(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: PutPhotoEntryGearDto,
  ): Promise<PhotoEntryGearListResponse> {
    return this.gear.replace(userId, id, dto);
  }

  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_MANAGE)
  @Post(':id/gear/confirm')
  @ApiOperation({
    summary: 'Declare the gear as complete',
    description: 'SHOT entries only; valid with an empty list.',
  })
  @ApiOkResponse({ type: PhotoEntryGearListResponse })
  confirm(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<PhotoEntryGearListResponse> {
    return this.gear.confirm(userId, id);
  }

  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_MANAGE)
  @Post(':id/gear/from-kit/:kitId')
  @ApiOperation({
    summary: 'Expand a kit into the list',
    description:
      'Copies the kit into ordinary rows. Rows already on the list are kept; RETIRED gear is skipped.',
  })
  @ApiOkResponse({ type: PhotoEntryGearListResponse })
  addFromKit(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Param('kitId', ParseUUIDPipe) kitId: string,
  ): Promise<PhotoEntryGearListResponse> {
    return this.gear.addFromKit(userId, id, kitId);
  }

  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_MANAGE)
  @Post(':id/gear/:gearItemId')
  @ApiOkResponse({ type: PhotoEntryGearListResponse })
  add(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Param('gearItemId', ParseUUIDPipe) gearItemId: string,
    @Body() dto: AddPhotoEntryGearDto,
  ): Promise<PhotoEntryGearListResponse> {
    return this.gear.add(userId, id, gearItemId, dto);
  }

  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_MANAGE)
  @Patch(':id/gear/:gearItemId')
  @ApiOperation({
    summary: 'Tick one row',
    description:
      '`secured: true` implies `used`; `used: false` clears `secured`. ' +
      'used/secured need a SHOT entry and gear that is not on the wishlist.',
  })
  @ApiOkResponse({ type: PhotoEntryGearListResponse })
  patch(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Param('gearItemId', ParseUUIDPipe) gearItemId: string,
    @Body() dto: PatchPhotoEntryGearDto,
  ): Promise<PhotoEntryGearListResponse> {
    return this.gear.patch(userId, id, gearItemId, dto);
  }

  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_MANAGE)
  @Delete(':id/gear/:gearItemId')
  @ApiOkResponse({ type: PhotoEntryGearListResponse })
  remove(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Param('gearItemId', ParseUUIDPipe) gearItemId: string,
  ): Promise<PhotoEntryGearListResponse> {
    return this.gear.remove(userId, id, gearItemId);
  }
}
