import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators';
import { HomePublicService } from './home-public.service';
import { PublicHomeResponse } from './responses';

@Controller('blog/home')
@ApiTags('Blog · Home')
export class HomePublicController {
  constructor(private readonly homePublicService: HomePublicService) {}

  @Public()
  @Get()
  @ApiQuery({ name: 'locale', required: false })
  @ApiOkResponse({
    description: 'Opinionated homepage — pinned + latest post cards',
    type: PublicHomeResponse,
  })
  getHome(@Query('locale') locale?: string): Promise<PublicHomeResponse> {
    return this.homePublicService.getHome(locale);
  }
}
