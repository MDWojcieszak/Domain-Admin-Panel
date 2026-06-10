import { Module } from '@nestjs/common';

import { BlogCommonModule } from '../common/blog-common.module';
import { VersioningModule } from '../versioning/versioning.module';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';

/**
 * "Document" save contract for the Notion-style editor: one PUT reconciles the
 * whole draft into relational sections (reusing the section model, lazy-clone
 * and field rules). Coexists with the per-section endpoints.
 */
@Module({
  imports: [BlogCommonModule, VersioningModule],
  controllers: [DocumentController],
  providers: [DocumentService],
})
export class DocumentModule {}
