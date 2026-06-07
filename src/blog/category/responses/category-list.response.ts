import { IsNested, IsNumber } from 'nestjs-swagger-dto';

import { CategoryResponse } from './category.response';
import { ResolvedCategoryResponse } from './resolved-category.response';

export class CategoryListResponse {
  @IsNumber({ type: 'integer' })
  total: number;

  @IsNested({ type: CategoryResponse, isArray: true })
  categories: CategoryResponse[];
}

export class ResolvedCategoryListResponse {
  @IsNumber({ type: 'integer' })
  total: number;

  @IsNested({ type: ResolvedCategoryResponse, isArray: true })
  categories: ResolvedCategoryResponse[];
}
