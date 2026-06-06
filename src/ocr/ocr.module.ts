import { Module } from '@nestjs/common';
import { OcrService } from './ocr.service';
import { OcrController } from './ocr.controller';
import { RapidOcrClient } from './ocr-rapid.client';
import { CleanerService } from './cleaner.service';
import { OllamaClient } from '../ai/clients';
import { ClassificationService } from '../classification/classification.service';

@Module({
  controllers: [OcrController],
  providers: [
    RapidOcrClient,
    OllamaClient,
    CleanerService,
    ClassificationService,
    OcrService,
  ],
  exports: [RapidOcrClient, OcrService],
})
export class OcrModule {}
