import { Global, Module } from '@nestjs/common';

import { IntegrationTokenService } from './integration-token.service';

/**
 * Global so the APP_GUARD (AuthorizationGuard) can inject the token service —
 * same pattern as AclCoreModule. Kept separate from IntegrationModule so the
 * guard does not drag the controllers into every module's injector.
 */
@Global()
@Module({
  providers: [IntegrationTokenService],
  exports: [IntegrationTokenService],
})
export class IntegrationCoreModule {}
