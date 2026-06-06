import { Global, Module } from '@nestjs/common';

import { PermissionsService } from './permissions.service';

/**
 * Global so both the APP_GUARD (PermissionsGuard) and the WebsocketGateway can
 * inject the shared PermissionsService.
 */
@Global()
@Module({
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class AclCoreModule {}
