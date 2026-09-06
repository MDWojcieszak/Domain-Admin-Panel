import { Module } from '@nestjs/common';

import { DeviceAuthController } from './device-auth.controller';
import { DeviceAuthorizationService } from './device-authorization.service';
import { IntegrationController } from './integration.controller';

@Module({
  controllers: [DeviceAuthController, IntegrationController],
  providers: [DeviceAuthorizationService],
})
export class IntegrationModule {}
