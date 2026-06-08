import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto';
import { SearchResultsResponse } from './responses';

@Controller('blog/search')
@ApiTags('Blog · Search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @Get()
  @ApiOkResponse({
    description: 'Full-text search over published, PUBLIC content',
    type: SearchResultsResponse,
  })
  async search(@Query() query: SearchQueryDto): Promise<SearchResultsResponse> {
    return this.searchService.search(query);
  }
}
