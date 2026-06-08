import { Module } from '@nestjs/common';

import { BlogCommonModule } from '../common/blog-common.module';
import { LicenseModule } from '../license/license.module';
import { DeviceController } from './device.controller';
import { DeviceService } from './device.service';

@Module({
  imports: [BlogCommonModule, LicenseModule],
  controllers: [DeviceController],
  providers: [DeviceService],
  exports: [DeviceService],
})
export class DeviceModule {}
