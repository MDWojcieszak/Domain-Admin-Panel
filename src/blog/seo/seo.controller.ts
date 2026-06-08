import { Controller, Get, Header } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators';
import { SeoService } from './seo.service';

@Controller('blog')
@ApiTags('Blog · SEO')
export class SeoController {
  constructor(private readonly seoService: SeoService) {}

  @Public()
  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml')
  @ApiOkResponse({ description: 'XML sitemap of published public posts' })
  async sitemap(): Promise<string> {
    return this.seoService.buildSitemap();
  }
}
