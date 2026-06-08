import { Module } from '@nestjs/common';

import { AccessModule } from '../access/access.module';
import { LicenseModule } from '../license/license.module';
import { DeviceController } from './device.controller';
import { DeviceService } from './device.service';

@Module({
  imports: [AccessModule, LicenseModule],
  controllers: [DeviceController],
  providers: [DeviceService],
  exports: [DeviceService],
})
export class DeviceModule {}
