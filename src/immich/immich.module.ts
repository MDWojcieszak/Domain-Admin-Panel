import { Module } from '@nestjs/common';
import { ImmichApiService } from './immich-api.service';
import { ImmichController } from './immich.controller';
import { TokenService } from '../token/token.service';
import { ImmichService } from './immich.service';

@Module({
  providers: [ImmichApiService, TokenService, ImmichService],
  controllers: [ImmichController],
})
export class ImmichModule {}
