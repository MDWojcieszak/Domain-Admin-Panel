import { Module } from '@nestjs/common';
import { ClassificationService } from './classification.service';
import { OllamaClient } from '../ai/clients';

@Module({
  providers: [ClassificationService, OllamaClient],
  exports: [ClassificationService],
})
export class ClassificationModule {}
