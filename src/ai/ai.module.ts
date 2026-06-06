import { Module } from '@nestjs/common';
import { OllamaClient } from './clients';
import { OllamaController } from './ollama.controller';

@Module({
  controllers: [OllamaController],
  providers: [OllamaClient],
  exports: [OllamaClient],
})
export class AiModule {}
