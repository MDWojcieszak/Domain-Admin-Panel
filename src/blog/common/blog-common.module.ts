import { Module } from '@nestjs/common';

import { AccessTierResolver } from './access-tier-resolver.service';
import { LocaleResolver } from './locale-resolver.service';
import { LocaleController } from './locale.controller';

/**
 * Shared blog plumbing (locale + access-tier resolution) reused across blog
 * sub-modules. PrismaModule is global, so no import is needed here.
 */
@Module({
  controllers: [LocaleController],
  providers: [LocaleResolver, AccessTierResolver],
  exports: [LocaleResolver, AccessTierResolver],
})
export class BlogCommonModule {}
