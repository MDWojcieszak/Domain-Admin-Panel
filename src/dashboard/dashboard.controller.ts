import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../common/decorators';
import { PERMISSIONS } from '../common/acl/permissions';
import { DashboardService } from './dashboard.service';
import { DashboardTrendsQueryDto } from './dto';
import {
  DashboardGalleryResponseDto,
  DashboardResponseDto,
  DashboardTrendsResponseDto,
} from './responses';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @RequirePermissions(PERMISSIONS.DASHBOARD_READ)
  @Get()
  @ApiOkResponse({ type: DashboardResponseDto })
  getOverview(): Promise<DashboardResponseDto> {
    return this.dashboardService.getOverview();
  }

  @RequirePermissions(PERMISSIONS.DASHBOARD_READ)
  @Get('gallery')
  @ApiOkResponse({ type: DashboardGalleryResponseDto })
  getGallery(): Promise<DashboardGalleryResponseDto> {
    return this.dashboardService.getGallery();
  }

  @RequirePermissions(PERMISSIONS.DASHBOARD_READ)
  @Get('trends')
  @ApiOkResponse({ type: DashboardTrendsResponseDto })
  getTrends(
    @Query() query: DashboardTrendsQueryDto,
  ): Promise<DashboardTrendsResponseDto> {
    return this.dashboardService.getTrends(query.range);
  }
}
