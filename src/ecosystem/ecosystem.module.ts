import { Module } from '@nestjs/common';

import { AccessModule } from './access/access.module';
import { GrantModule } from './grant/grant.module';
import { RedeemModule } from './redeem/redeem.module';
import { DeviceModule } from './device/device.module';
import { LicenseModule } from './license/license.module';

/**
 * Ecosystem / account area: entitlement (access grants), redeem codes, app
 * devices and offline Ed25519 licenses. Separate from the blog content domain —
 * the blog only consumes the effective access tier (AccessModule). The app talks
 * to /ecosystem/* for licensing, never to /blog/*.
 */
@Module({
  imports: [
    AccessModule,
    GrantModule,
    RedeemModule,
    DeviceModule,
    LicenseModule,
  ],
  exports: [AccessModule],
})
export class EcosystemModule {}
