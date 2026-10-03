import { Transform } from 'class-transformer';
import { IsBoolean, IsString } from 'nestjs-swagger-dto';

import { PaginationDto } from '../../common/dto/pagination.dto';
import { toBoolean } from '../../common/helpers/cast.helper';

/** Picker for gear photos: reuse one photo across identical items. */
export class GetGearImagesQueryDto extends PaginationDto {
  /** Matches brand or model of the gear already using the photo. */
  @IsString({ optional: true })
  search?: string;

  /** Only photos not attached to any gear item or system yet. */
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ optional: true })
  unusedOnly?: boolean;
}
