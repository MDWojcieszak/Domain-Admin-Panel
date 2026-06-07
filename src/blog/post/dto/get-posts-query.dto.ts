import { BlogPostStatus } from '@prisma/client';
import { IsEnum, IsString } from 'nestjs-swagger-dto';

import { PaginationDto } from '../../../common/dto/pagination.dto';

export class GetPostsQueryDto extends PaginationDto {
  @IsEnum({ enum: { BlogPostStatus }, optional: true })
  status?: BlogPostStatus;

  @IsString({
    optional: true,
    description: 'Filter by slug (contains, case-insensitive).',
  })
  search?: string;
}
