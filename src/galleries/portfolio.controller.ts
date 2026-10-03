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
import { GearService } from '../gear/gear.service';
import { GearOverviewResponse } from '../gear/responses';
import { GalleriesService } from './galleries.service';
import { PortfolioGalleryQueryDto } from './dto';
import {
  PortfolioGalleryListResponse,
  PortfolioHeroResponse,
  PortfolioHomeResponse,
  PortfolioSettingsResponse,
} from './responses';
import { PortfolioGalleryPageResponse } from './responses/portfolio-gallery-detail.response';
import { ContactSettingsService } from '../inquiry/contact-settings.service';

/** Public, no-auth portfolio API. Only PUBLISHED galleries / non-hidden images. */
@ApiTags('Portfolio')
@Controller('portfolio')
export class PortfolioController {
  constructor(
    private readonly galleries: GalleriesService,
    private readonly gearService: GearService,
    private readonly contact: ContactSettingsService,
  ) {}

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
  @Get('home')
  @ApiOkResponse({
    description: 'Composed home page: hero + featured galleries with previews',
    type: PortfolioHomeResponse,
  })
  home(): Promise<PortfolioHomeResponse> {
    return this.galleries.listHome();
  }

  @Public()
  @Get('settings')
  @ApiOkResponse({
    description: 'Public portfolio home settings (display limits)',
    type: PortfolioSettingsResponse,
  })
  settings(): Promise<PortfolioSettingsResponse> {
    return this.galleries.getSettings();
  }

  @Public()
  @Get('gear')
  @ApiOkResponse({
    description: 'Photographer gear grouped by camera system (visible only)',
    type: GearOverviewResponse,
  })
  gear(): Promise<GearOverviewResponse> {
    return this.gearService.listPublic();
  }

  @Public()
  @Get('galleries/:slug')
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiOkResponse({
    description:
      'A published gallery with its ordered, visible images and the contact ' +
      'form (privacy notice included) in the language given by ?locale=',
    type: PortfolioGalleryPageResponse,
  })
  async bySlug(
    @Param('slug') slug: string,
    @Query() query: PortfolioGalleryQueryDto,
    @Query('take', new ParseIntPipe({ optional: true })) take?: number,
    @Query('skip', new ParseIntPipe({ optional: true })) skip?: number,
  ): Promise<PortfolioGalleryPageResponse> {
    const [gallery, contact] = await Promise.all([
      this.galleries.getPublishedBySlug(slug, query.orientation, take, skip),
      this.contact.getPublic(query.locale),
    ]);
    return { ...gallery, contact };
  }
}
