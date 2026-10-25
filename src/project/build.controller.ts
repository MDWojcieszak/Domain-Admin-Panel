import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { GetCurrentUser } from '../common/decorators';
import { BomService } from './bom.service';
import {
  BomShoppingListDto,
  CreateBomItemDto,
  CreateJournalEntryDto,
  ReorderIdsDto,
  SetBomPhotoDto,
  SetBomStatusDto,
  UpdateBomItemDto,
  UpdateJournalEntryDto,
} from './dto';
import { JournalService } from './journal.service';
import {
  BomResponse,
  BomShoppingListResponse,
  JournalEntryResponse,
} from './responses';

/**
 * What a build (DIY) project adds: its parts list and its work journal (D6).
 * They exist on any project; the panel shows them for builds. Every BOM call
 * answers with the whole list and its totals.
 */
@ApiTags('Builds')
@ApiBearerAuth()
@Controller()
export class BuildController {
  constructor(
    private readonly bom: BomService,
    private readonly journal: JournalService,
  ) {}

  // — bill of materials —

  @Get('projects/:id/bom')
  @ApiOkResponse({ type: BomResponse })
  listBom(
    @GetCurrentUser('sub') userId: string,
    @Param('id') projectId: string,
  ): Promise<BomResponse> {
    return this.bom.list(userId, projectId);
  }

  @Post('projects/:id/bom')
  @ApiOkResponse({ type: BomResponse })
  addBomItem(
    @GetCurrentUser('sub') userId: string,
    @Param('id') projectId: string,
    @Body() dto: CreateBomItemDto,
  ): Promise<BomResponse> {
    return this.bom.create(userId, projectId, dto);
  }

  /** Needed parts onto a shopping list, new or existing. */
  @Post('projects/:id/bom/shopping-list')
  @ApiOkResponse({ type: BomShoppingListResponse })
  toShoppingList(
    @GetCurrentUser('sub') userId: string,
    @Param('id') projectId: string,
    @Body() dto: BomShoppingListDto,
  ): Promise<BomShoppingListResponse> {
    return this.bom.toShoppingList(userId, projectId, dto);
  }

  @Put('projects/:id/bom/order')
  @ApiOkResponse({ type: BomResponse })
  reorderBom(
    @GetCurrentUser('sub') userId: string,
    @Param('id') projectId: string,
    @Body() dto: ReorderIdsDto,
  ): Promise<BomResponse> {
    return this.bom.reorder(userId, projectId, dto.ids);
  }

  @Patch('bom/:itemId')
  @ApiOkResponse({ type: BomResponse })
  updateBomItem(
    @GetCurrentUser('sub') userId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateBomItemDto,
  ): Promise<BomResponse> {
    return this.bom.update(userId, itemId, dto);
  }

  /** Ordered, have, used: viewers too when the project lets them tick. */
  @Post('bom/:itemId/status')
  @ApiOkResponse({ type: BomResponse })
  setBomStatus(
    @GetCurrentUser('sub') userId: string,
    @Param('itemId') itemId: string,
    @Body() dto: SetBomStatusDto,
  ): Promise<BomResponse> {
    return this.bom.setStatus(userId, itemId, dto.status);
  }

  /** One of the part's own pinned images becomes its photo. */
  @Put('bom/:itemId/photo')
  @ApiOkResponse({ type: BomResponse })
  setBomPhoto(
    @GetCurrentUser('sub') userId: string,
    @Param('itemId') itemId: string,
    @Body() dto: SetBomPhotoDto,
  ): Promise<BomResponse> {
    return this.bom.setPhoto(userId, itemId, dto.documentId);
  }

  @Delete('bom/:itemId/photo')
  @ApiOkResponse({ type: BomResponse })
  clearBomPhoto(
    @GetCurrentUser('sub') userId: string,
    @Param('itemId') itemId: string,
  ): Promise<BomResponse> {
    return this.bom.clearPhoto(userId, itemId);
  }

  @Delete('bom/:itemId')
  @ApiOkResponse({ type: BomResponse })
  removeBomItem(
    @GetCurrentUser('sub') userId: string,
    @Param('itemId') itemId: string,
  ): Promise<BomResponse> {
    return this.bom.remove(userId, itemId);
  }

  // — work journal —

  @Get('projects/:id/journal')
  @ApiOkResponse({ type: JournalEntryResponse, isArray: true })
  listJournal(
    @GetCurrentUser('sub') userId: string,
    @Param('id') projectId: string,
  ): Promise<JournalEntryResponse[]> {
    return this.journal.list(userId, projectId);
  }

  @Post('projects/:id/journal')
  @ApiOkResponse({ type: JournalEntryResponse })
  addJournalEntry(
    @GetCurrentUser('sub') userId: string,
    @Param('id') projectId: string,
    @Body() dto: CreateJournalEntryDto,
  ): Promise<JournalEntryResponse> {
    return this.journal.create(userId, projectId, dto);
  }

  @Patch('journal/:entryId')
  @ApiOkResponse({ type: JournalEntryResponse })
  updateJournalEntry(
    @GetCurrentUser('sub') userId: string,
    @Param('entryId') entryId: string,
    @Body() dto: UpdateJournalEntryDto,
  ): Promise<JournalEntryResponse> {
    return this.journal.update(userId, entryId, dto);
  }

  @Delete('journal/:entryId')
  removeJournalEntry(
    @GetCurrentUser('sub') userId: string,
    @Param('entryId') entryId: string,
  ): Promise<void> {
    return this.journal.remove(userId, entryId);
  }
}
