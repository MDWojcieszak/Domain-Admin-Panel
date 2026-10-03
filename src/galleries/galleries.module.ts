import { Module } from '@nestjs/common';
import { GalleriesController } from './galleries.controller';
import { PortfolioController } from './portfolio.controller';
import { GalleriesService } from './galleries.service';
import { GearModule } from '../gear/gear.module';
import { InquiryModule } from '../inquiry/inquiry.module';

@Module({
  imports: [GearModule, InquiryModule],
  controllers: [GalleriesController, PortfolioController],
  providers: [GalleriesService],
  exports: [GalleriesService],
})
export class GalleriesModule {}
