import { Module } from '@nestjs/common';

import { GearController } from './gear.controller';
import { GearService } from './gear.service';
import { FileService } from '../file/file.service';

@Module({
  controllers: [GearController],
  providers: [GearService, FileService],
  exports: [GearService],
})
export class GearModule {}
