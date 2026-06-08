import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators';
import { LicenseService } from './license.service';
import { PublicKeyResponse } from './responses';

@Controller('blog/license')
@ApiTags('Blog · License')
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Public()
  @Get('public-key')
  @ApiOkResponse({
    description: 'Ed25519 public key (PEM) for offline verification',
    type: PublicKeyResponse,
  })
  getPublicKey(): PublicKeyResponse {
    return { publicKey: this.licenseService.getPublicKeyPem() };
  }
}
