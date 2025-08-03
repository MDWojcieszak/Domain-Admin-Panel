import { PlaceType } from '@prisma/client';
import { IsEnum, IsNested, IsString } from 'nestjs-swagger-dto';
import { AiLogFieldsDto } from '../../common/dto';
import { LocationCreateDto } from './location-create.dto';

export class PlaceUpdateDto extends AiLogFieldsDto {
  @IsString({ optional: true })
  name?: string;

  @IsString({ optional: true })
  description?: string;

  @IsEnum({ enum: { PlaceType }, optional: true })
  type?: PlaceType;

  @IsNested({ type: LocationCreateDto, optional: true })
  location?: LocationCreateDto;
}
