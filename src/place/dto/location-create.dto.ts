import { IsString, IsNumber } from 'nestjs-swagger-dto';

export class LocationCreateDto {
  @IsString({ optional: true })
  name?: string;

  @IsString({ optional: true })
  address?: string;

  @IsString({ optional: true })
  city?: string;

  @IsString({ optional: true })
  postalCode?: string;

  @IsString({ optional: true })
  country?: string;

  @IsNumber({
    optional: true,
    example: 50,
    description: 'Radius in meters',
    type: 'integer',
  })
  radius?: number;

  @IsNumber({ optional: true })
  latitude?: number;

  @IsNumber({ optional: true })
  longitude?: number;

  @IsString({ optional: true })
  description?: string;
}
