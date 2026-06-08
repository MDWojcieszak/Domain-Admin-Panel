import { IsNested } from 'nestjs-swagger-dto';

import { ResolvedCategoryResponse } from '../../category/responses';

export class PostCategoriesResponse {
  @IsNested({ type: ResolvedCategoryResponse, isArray: true })
  categories: ResolvedCategoryResponse[];
}
