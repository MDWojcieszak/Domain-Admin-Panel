import { Module } from '@nestjs/common';

import { BlogCommonModule } from './common/blog-common.module';
import { PostModule } from './post/post.module';
import { SectionModule } from './section/section.module';
import { VersioningModule } from './versioning/versioning.module';
import { PoiModule } from './poi/poi.module';
import { CategoryModule } from './category/category.module';
import { CollectionModule } from './collection/collection.module';
import { SearchModule } from './search/search.module';
import { SeoModule } from './seo/seo.module';
import { HomeModule } from './home/home.module';
import { TemplateModule } from './template/template.module';
import { CommentModule } from './comment/comment.module';
import { InteractionModule } from './interaction/interaction.module';
import { LicenseModule } from './license/license.module';
import { GrantModule } from './grant/grant.module';
import { RedeemModule } from './redeem/redeem.module';
import { DeviceModule } from './device/device.module';
import { BlogSeedService } from './seed/blog-seed.service';

/**
 * Blog/CMS module (modular monolith). Sub-modules follow the photo-entry
 * convention (controller/service/module/dto/responses/mappers). Further phases
 * add poi/category/home/template/interaction/insights/search sub-modules.
 */
@Module({
  imports: [
    BlogCommonModule,
    PostModule,
    SectionModule,
    VersioningModule,
    PoiModule,
    CategoryModule,
    CollectionModule,
    SearchModule,
    SeoModule,
    HomeModule,
    TemplateModule,
    CommentModule,
    InteractionModule,
    LicenseModule,
    GrantModule,
    RedeemModule,
    DeviceModule,
  ],
  providers: [BlogSeedService],
})
export class BlogModule {}
