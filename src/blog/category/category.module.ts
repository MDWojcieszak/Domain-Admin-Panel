import { Module } from '@nestjs/common';

import { BlogCommonModule } from '../common/blog-common.module';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';

@Module({
  imports: [BlogCommonModule],
  controllers: [CategoryController],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class CategoryModule {}
