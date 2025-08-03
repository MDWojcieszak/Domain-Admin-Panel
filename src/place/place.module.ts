import { Module } from '@nestjs/common';
import { PlaceController } from './place.controller';
import { PlaceService } from './place.service';
import { PlaceAiController } from './place-ai.controller';
import { PlaceAiService } from './place-ai.service';

@Module({
  controllers: [PlaceController, PlaceAiController],
  providers: [PlaceService, PlaceAiService],
})
export class PlaceModule {}
