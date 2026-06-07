import { Module } from '@nestjs/common';

import { BlogCommonModule } from '../common/blog-common.module';
import { PostController } from './post.controller';
import { PostService } from './post.service';

@Module({
  imports: [BlogCommonModule],
  controllers: [PostController],
  providers: [PostService],
  exports: [PostService],
})
export class PostModule {}
