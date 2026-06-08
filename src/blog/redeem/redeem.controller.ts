import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { GetCurrentUser, RequirePermissions } from '../../common/decorators';
import { PERMISSIONS } from '../../common/acl/permissions';
import { RedeemService } from './redeem.service';
import { CreateCodeDto, GetCodesQueryDto, RedeemCodeDto } from './dto';
import {
  CodeListResponse,
  RedeemCodeResponse,
  RedeemResultResponse,
} from './responses';

@Controller('blog')
@ApiTags('Blog · Redeem codes')
@ApiBearerAuth()
export class RedeemController {
  constructor(private readonly redeemService: RedeemService) {}

  // ----- user redeem (any authenticated user) -----

  @Post('redeem')
  @ApiOkResponse({ description: 'Redeemed a code', type: RedeemResultResponse })
  async redeem(
    @GetCurrentUser('sub') userId: string,
    @Body() dto: RedeemCodeDto,
  ): Promise<RedeemResultResponse> {
    return this.redeemService.redeem(userId, dto);
  }

  // ----- admin code management (BLOG_GRANT_MANAGE) -----

  @RequirePermissions(PERMISSIONS.BLOG_GRANT_MANAGE)
  @Post('codes')
  @ApiOkResponse({ description: 'Created code', type: RedeemCodeResponse })
  async createCode(@Body() dto: CreateCodeDto): Promise<RedeemCodeResponse> {
    return this.redeemService.createCode(dto);
  }

  @RequirePermissions(PERMISSIONS.BLOG_GRANT_MANAGE)
  @Get('codes')
  @ApiOkResponse({ description: 'List codes', type: CodeListResponse })
  async listCodes(@Query() query: GetCodesQueryDto): Promise<CodeListResponse> {
    return this.redeemService.listCodes(query);
  }

  @RequirePermissions(PERMISSIONS.BLOG_GRANT_MANAGE)
  @Delete('codes/:id')
  @ApiOkResponse({ description: 'Revoked code', type: RedeemCodeResponse })
  async revokeCode(@Param('id') id: string): Promise<RedeemCodeResponse> {
    return this.redeemService.revokeCode(id);
  }
}
