import { Module } from '@nestjs/common';

import { AclService } from './acl.service';
import { AclController } from './acl.controller';

@Module({
  providers: [AclService],
  controllers: [AclController],
})
export class AclModule {}
