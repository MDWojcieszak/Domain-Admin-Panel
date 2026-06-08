import { IsString } from 'nestjs-swagger-dto';

import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateHomeLayoutDto {
  @IsString()
  name: string;
}

export class PatchHomeLayoutDto {
  @IsString({ optional: true })
  name?: string;
}

export class GetHomeLayoutsQueryDto extends PaginationDto {
  @IsString({
    optional: true,
    description: 'Name contains (case-insensitive).',
  })
  search?: string;
}
