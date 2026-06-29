import { Module } from '@nestjs/common';
import { ImmichApiService } from './immich-api.service';
import { ImmichController } from './immich.controller';
import { TokenModule } from '../token/token.module';
import { ImmichService } from './immich.service';

@Module({
  imports: [TokenModule],
  providers: [ImmichApiService, ImmichService],
  controllers: [ImmichController],
})
export class ImmichModule {}
