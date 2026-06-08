import { Module } from '@nestjs/common';

import { LocaleResolver } from './locale-resolver.service';
import { LocaleController } from './locale.controller';

/**
 * Shared blog plumbing (locale resolution) reused across blog sub-modules.
 * Access-tier resolution lives in the ecosystem AccessModule (shared entitlement
 * domain). PrismaModule is global, so no import is needed here.
 */
@Module({
  controllers: [LocaleController],
  providers: [LocaleResolver],
  exports: [LocaleResolver],
})
export class BlogCommonModule {}
