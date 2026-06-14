import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators';
import { CountryService } from './country.service';
import { BlogCountryMenuResponse, BlogCountryPageResponse } from './responses';

@Controller('blog/countries')
@ApiTags('Blog · Countries')
export class CountryPublicController {
  constructor(private readonly countryService: CountryService) {}

  /** Global country navigation (only countries with published content). */
  @Public()
  @Get()
  @ApiQuery({ name: 'locale', required: false })
  @ApiOkResponse({ type: BlogCountryMenuResponse })
  menu(@Query('locale') locale?: string): Promise<BlogCountryMenuResponse> {
    return this.countryService.menu(locale);
  }

  /** Country page header (lists via `GET /blog/posts/public?country=<slug>` + `/blog/poi?country=`). */
  @Public()
  @Get('by-slug/:slug')
  @ApiQuery({ name: 'locale', required: false })
  @ApiOkResponse({ type: BlogCountryPageResponse })
  page(
    @Param('slug') slug: string,
    @Query('locale') locale?: string,
  ): Promise<BlogCountryPageResponse> {
    return this.countryService.page(slug, locale);
  }
}
