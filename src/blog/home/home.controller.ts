import { Body, Controller, Get, Patch, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../common/decorators';
import { PERMISSIONS } from '../../common/acl/permissions';
import { HomeService } from './home.service';
import { PatchHomeConfigDto, SetHomePinsDto } from './dto';
import { HomeConfigResponse, HomePinsResponse } from './responses';

/** Homepage admin: the singleton config + the pinned-post slots. */
@Controller('blog/home')
@ApiTags('Blog · Home (admin)')
@ApiBearerAuth()
@RequirePermissions(PERMISSIONS.BLOG_HOME_MANAGE)
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get('config')
  @ApiOkResponse({ type: HomeConfigResponse })
  getConfig(): Promise<HomeConfigResponse> {
    return this.homeService.getConfig();
  }

  @Patch('config')
  @ApiOkResponse({ type: HomeConfigResponse })
  patchConfig(@Body() dto: PatchHomeConfigDto): Promise<HomeConfigResponse> {
    return this.homeService.patchConfig(dto);
  }

  @Get('pins')
  @ApiOkResponse({ type: HomePinsResponse })
  getPins(): Promise<HomePinsResponse> {
    return this.homeService.getPins();
  }

  @Put('pins')
  @ApiOkResponse({ type: HomePinsResponse })
  setPins(@Body() dto: SetHomePinsDto): Promise<HomePinsResponse> {
    return this.homeService.setPins(dto);
  }
}
