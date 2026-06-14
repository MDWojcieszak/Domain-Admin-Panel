import { Module } from '@nestjs/common';

import { BlogCommonModule } from '../common/blog-common.module';
import { CountryController } from './country.controller';
import { CountryPublicController } from './country-public.controller';
import { CountryService } from './country.service';

/** Canonical countries (first-class): admin CRUD + global menu + country page. */
@Module({
  imports: [BlogCommonModule],
  controllers: [CountryController, CountryPublicController],
  providers: [CountryService],
})
export class CountryModule {}
