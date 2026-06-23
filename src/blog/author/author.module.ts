import { Module } from '@nestjs/common';

import { BlogCommonModule } from '../common/blog-common.module';
import { AuthorPublicController } from './author-public.controller';
import { AuthorService } from './author.service';

/** Public byline resolution (userId → name + avatar) for post authors. */
@Module({
  imports: [BlogCommonModule],
  controllers: [AuthorPublicController],
  providers: [AuthorService],
})
export class AuthorModule {}
