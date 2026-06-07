import { Module } from '@nestjs/common';

import { BlogCommonModule } from '../common/blog-common.module';
import { VersioningModule } from '../versioning/versioning.module';
import { SectionController } from './section.controller';
import { SectionService } from './section.service';

@Module({
  imports: [BlogCommonModule, VersioningModule],
  controllers: [SectionController],
  providers: [SectionService],
  exports: [SectionService],
})
export class SectionModule {}
