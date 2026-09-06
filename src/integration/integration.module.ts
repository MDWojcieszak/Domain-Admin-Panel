import { Module } from '@nestjs/common';

import { DeviceAuthController } from './device-auth.controller';
import { DeviceAuthorizationService } from './device-authorization.service';
import { IntegrationController } from './integration.controller';
import { IntegrationMaintenanceService } from './integration-maintenance.service';

@Module({
  controllers: [DeviceAuthController, IntegrationController],
  providers: [DeviceAuthorizationService, IntegrationMaintenanceService],
})
export class IntegrationModule {}
