import { Module } from '@nestjs/common';

import { BlogCommonModule } from '../common/blog-common.module';
import { SectionController } from './section.controller';
import { SectionService } from './section.service';

@Module({
  imports: [BlogCommonModule],
  controllers: [SectionController],
  providers: [SectionService],
  exports: [SectionService],
})
export class SectionModule {}
