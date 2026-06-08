import { Module } from '@nestjs/common';

import { BlogCommonModule } from '../common/blog-common.module';
import { SeoController } from './seo.controller';
import { SeoService } from './seo.service';

@Module({
  imports: [BlogCommonModule],
  controllers: [SeoController],
  providers: [SeoService],
})
export class SeoModule {}
