import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators';
import { CountriesService } from './countries.service';
import { BlogCountriesResponse } from './responses';

@Controller('blog/countries')
@ApiTags('Blog · Countries')
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  /** Countries with published content (posts/POIs) + counts. Global navigation. */
  @Public()
  @Get()
  @ApiOkResponse({ type: BlogCountriesResponse })
  list(): Promise<BlogCountriesResponse> {
    return this.countriesService.list();
  }
}
