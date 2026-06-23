import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { Public, RequirePermissions } from '../../common/decorators';
import { PERMISSIONS } from '../../common/acl/permissions';
import { LocaleResolver } from './locale-resolver.service';
import { BlogLocaleListResponse } from './responses';

@Controller('blog/locales')
@ApiTags('Blog · Locales')
@ApiBearerAuth()
export class LocaleController {
  constructor(private readonly localeResolver: LocaleResolver) {}

  @Public()
  @Get('public')
  @ApiOkResponse({
    description: 'Enabled blog locales + default (public language switcher)',
    type: BlogLocaleListResponse,
  })
  async listPublic(): Promise<BlogLocaleListResponse> {
    return this.buildList();
  }

  @RequirePermissions(PERMISSIONS.BLOG_READ)
  @Get()
  @ApiOkResponse({
    description: 'Enabled blog locales + the default (fallback) locale',
    type: BlogLocaleListResponse,
  })
  async list(): Promise<BlogLocaleListResponse> {
    return this.buildList();
  }

  private async buildList(): Promise<BlogLocaleListResponse> {
    const [locales, defaultLocale] = await Promise.all([
      this.localeResolver.listEnabled(),
      this.localeResolver.getDefaultCode(),
    ]);

    return {
      defaultLocale,
      locales: locales.map((locale) => ({
        code: locale.code,
        name: locale.name,
        isDefault: locale.isDefault,
        order: locale.order,
      })),
    };
  }
}
