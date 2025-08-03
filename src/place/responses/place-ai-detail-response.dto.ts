import { IsString, IsNested, IsEnum, IsDate } from 'nestjs-swagger-dto';
import { PlaceType } from '@prisma/client';
import { AiContextResponseDto } from '../../common/responses';
import { LocationResponseDto } from './location-response.dto';

export class PlaceAiDetailResponseDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString({ optional: true })
  description?: string;

  @IsEnum({ enum: { PlaceType }, optional: true })
  type?: PlaceType;

  @IsDate({ format: 'date-time', optional: true })
  createdAt: Date;

  @IsDate({ format: 'date-time', optional: true })
  updatedAt: Date;

  @IsNested({ type: AiContextResponseDto, optional: true })
  aiContext?: AiContextResponseDto;

  @IsNested({ type: LocationResponseDto, optional: true })
  location?: LocationResponseDto;
}
