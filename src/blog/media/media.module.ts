import { Module } from '@nestjs/common';

import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { FileService } from '../../file/file.service';

/**
 * Blog media library (BLOG-scoped images + reusable albums). Kept separate from
 * the owner's personal gallery (GALLERY scope); managed via `blog.media.manage`.
 */
@Module({
  controllers: [MediaController],
  providers: [MediaService, FileService],
})
export class MediaModule {}
