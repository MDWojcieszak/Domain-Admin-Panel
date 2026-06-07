import { Module } from '@nestjs/common';

import { BlogCommonModule } from './common/blog-common.module';
import { PostModule } from './post/post.module';
import { SectionModule } from './section/section.module';
import { VersioningModule } from './versioning/versioning.module';
import { BlogSeedService } from './seed/blog-seed.service';

/**
 * Blog/CMS module (modular monolith). Sub-modules follow the photo-entry
 * convention (controller/service/module/dto/responses/mappers). Further phases
 * add poi/category/home/template/interaction/insights/search sub-modules.
 */
@Module({
  imports: [BlogCommonModule, PostModule, SectionModule, VersioningModule],
  providers: [BlogSeedService],
})
export class BlogModule {}
