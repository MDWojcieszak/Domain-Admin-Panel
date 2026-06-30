import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';

import { Public } from '../common/decorators';
import { GalleriesService } from './galleries.service';
import { PortfolioGalleryQueryDto } from './dto';
import {
  PortfolioGalleryDetailResponse,
  PortfolioGalleryListResponse,
  PortfolioHeroResponse,
} from './responses';

/** Public, no-auth portfolio API. Only PUBLISHED galleries / non-hidden images. */
@ApiTags('Portfolio')
@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly galleries: GalleriesService) {}

  @Public()
  @Get('galleries')
  @ApiOkResponse({
    description: 'Published galleries',
    type: PortfolioGalleryListResponse,
  })
  listGalleries(): Promise<PortfolioGalleryListResponse> {
    return this.galleries.listPublished();
  }

  @Public()
  @Get('hero')
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({
    description: 'Hero-role images for the homepage',
    type: PortfolioHeroResponse,
  })
  hero(
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number,
  ): Promise<PortfolioHeroResponse> {
    return this.galleries.listHero(limit);
  }

  @Public()
  @Get('galleries/:slug')
  @ApiOkResponse({
    description: 'A published gallery with its ordered, visible images',
    type: PortfolioGalleryDetailResponse,
  })
  bySlug(
    @Param('slug') slug: string,
    @Query() query: PortfolioGalleryQueryDto,
  ): Promise<PortfolioGalleryDetailResponse> {
    return this.galleries.getPublishedBySlug(slug, query.orientation);
  }
}
