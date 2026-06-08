import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { GetOptionalUser, Public } from '../../common/decorators';
import { OptionalAuthGuard } from '../../common/guards';
import { AccessTierResolver } from '../../ecosystem/access/access-tier-resolver.service';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto';
import { SearchResultsResponse } from './responses';

@Controller('blog/search')
@ApiTags('Blog · Search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly accessTierResolver: AccessTierResolver,
  ) {}

  @Public()
  @UseGuards(OptionalAuthGuard)
  @Get()
  @ApiOkResponse({
    description:
      'Full-text search over published content; premium results above the ' +
      "viewer's tier come back as locked teasers (no excerpt/body).",
    type: SearchResultsResponse,
  })
  async search(
    @Query() query: SearchQueryDto,
    @GetOptionalUser('sub') userId: string | null,
  ): Promise<SearchResultsResponse> {
    const viewerTier = await this.accessTierResolver.effectiveTier(userId);
    return this.searchService.search(query, viewerTier);
  }
}
