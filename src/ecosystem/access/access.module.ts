import { Module } from '@nestjs/common';

import { AccessTierResolver } from './access-tier-resolver.service';

/**
 * Entitlement core: resolves a user's effective access tier from active grants.
 * Consumed by the blog paywall AND by app-device licensing. Has no blog
 * dependency (the access domain is shared, not blog-owned).
 */
@Module({
  providers: [AccessTierResolver],
  exports: [AccessTierResolver],
})
export class AccessModule {}
