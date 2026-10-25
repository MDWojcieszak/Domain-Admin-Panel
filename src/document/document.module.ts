import { Module } from '@nestjs/common';

import { ProjectModule } from '../project/project.module';
import { DocumentLibraryController } from './document.controller';
import { DocumentMaintenanceService } from './document-maintenance.service';
import { DocumentService } from './document.service';

/** Any file, in its owner's library, pinned to projects and tasks. */
@Module({
  imports: [ProjectModule],
  controllers: [DocumentLibraryController],
  providers: [DocumentService, DocumentMaintenanceService],
})
export class DocumentModule {}
