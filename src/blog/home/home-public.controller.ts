import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators';
import { HomePublicService } from './home-public.service';
import { ResolvedHomeResponse } from './responses';

@Controller('blog/home')
@ApiTags('Blog · Home')
export class HomePublicController {
  constructor(private readonly homePublicService: HomePublicService) {}

  @Public()
  @Get()
  @ApiOkResponse({
    description: 'Active homepage layout resolved for a locale',
    type: ResolvedHomeResponse,
  })
  async getHome(
    @Query('locale') locale?: string,
  ): Promise<ResolvedHomeResponse> {
    return this.homePublicService.getActiveHome(locale);
  }
}
