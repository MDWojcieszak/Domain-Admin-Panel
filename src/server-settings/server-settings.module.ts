import { Module } from '@nestjs/common';
import { ServerSettingsController } from './server-settings.controller';
import { ServerSettingsService } from './server-settings.service';
import { MultiVerseModule } from '../multi-verse/multi-verse.module';

@Module({
  imports: [MultiVerseModule],
  controllers: [ServerSettingsController],
  providers: [ServerSettingsService],
})
export class ServerSettingsModule {}
