import { Module } from '@nestjs/common';

import { BlogCommonModule } from '../common/blog-common.module';
import { VersioningModule } from '../versioning/versioning.module';
import { TemplateController } from './template.controller';
import { TemplateService } from './template.service';

@Module({
  imports: [BlogCommonModule, VersioningModule],
  controllers: [TemplateController],
  providers: [TemplateService],
  exports: [TemplateService],
})
export class TemplateModule {}
