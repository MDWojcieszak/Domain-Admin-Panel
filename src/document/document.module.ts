import { Module } from '@nestjs/common';

import { ProjectModule } from '../project/project.module';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';

/** Any file, in its owner's library, pinned to projects and tasks. */
@Module({
  imports: [ProjectModule],
  controllers: [DocumentController],
  providers: [DocumentService],
})
export class DocumentModule {}
