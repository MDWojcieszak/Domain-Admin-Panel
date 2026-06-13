import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators';
import { BLOG_COLORS } from './rich-text';
import { BlogColorsResponse } from './responses';

@Controller('blog/colors')
@ApiTags('Blog · Colors')
export class ColorsController {
  /** The inline color palette. Tokens are theme-safe (reader maps to CSS vars). */
  @Public()
  @Get()
  @ApiOkResponse({ type: BlogColorsResponse })
  list(): BlogColorsResponse {
    return { colors: [...BLOG_COLORS] };
  }
}
