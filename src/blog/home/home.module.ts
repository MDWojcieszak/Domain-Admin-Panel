import { Module } from '@nestjs/common';

import { BlogCommonModule } from '../common/blog-common.module';
import { HomeController } from './home.controller';
import { HomePublicController } from './home-public.controller';
import { HomeService } from './home.service';
import { HomePublicService } from './home-public.service';

@Module({
  imports: [BlogCommonModule],
  controllers: [HomeController, HomePublicController],
  providers: [HomeService, HomePublicService],
})
export class HomeModule {}
