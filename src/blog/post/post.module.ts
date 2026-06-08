import { Module } from '@nestjs/common';

import { BlogCommonModule } from '../common/blog-common.module';
import { VersioningModule } from '../versioning/versioning.module';
import { OptionalAuthGuard } from '../../common/guards';
import { PostController } from './post.controller';
import { PostService } from './post.service';

@Module({
  imports: [BlogCommonModule, VersioningModule],
  controllers: [PostController],
  providers: [PostService, OptionalAuthGuard],
  exports: [PostService],
})
export class PostModule {}
