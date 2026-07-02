import { Module } from '@nestjs/common';
import { GalleriesController } from './galleries.controller';
import { PortfolioController } from './portfolio.controller';
import { GalleriesService } from './galleries.service';
import { GearModule } from '../gear/gear.module';

@Module({
  imports: [GearModule],
  controllers: [GalleriesController, PortfolioController],
  providers: [GalleriesService],
})
export class GalleriesModule {}
