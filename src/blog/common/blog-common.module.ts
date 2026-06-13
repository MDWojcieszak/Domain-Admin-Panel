import { Module } from '@nestjs/common';

import { LocaleResolver } from './locale-resolver.service';
import { LocaleController } from './locale.controller';
import { ColorsController } from './colors.controller';
import { CountriesController } from './countries.controller';
import { CountriesService } from './countries.service';

/**
 * Shared blog plumbing (locale resolution) reused across blog sub-modules.
 * Access-tier resolution lives in the ecosystem AccessModule (shared entitlement
 * domain). PrismaModule is global, so no import is needed here.
 */
@Module({
  controllers: [LocaleController, ColorsController, CountriesController],
  providers: [LocaleResolver, CountriesService],
  exports: [LocaleResolver],
})
export class BlogCommonModule {}
