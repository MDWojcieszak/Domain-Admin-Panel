import { IsString } from 'nestjs-swagger-dto';

import { PaginationDto } from '../../../common/dto/pagination.dto';

export class PublicPostsQueryDto extends PaginationDto {
  @IsString({ optional: true })
  locale?: string;

  @IsString({ optional: true, description: 'Category id or key.' })
  category?: string;

  @IsString({ optional: true })
  region?: string;

  @IsString({ optional: true, description: 'Country (language-neutral).' })
  country?: string;

  @IsString({ optional: true, description: 'Series slug or id.' })
  series?: string;
}
