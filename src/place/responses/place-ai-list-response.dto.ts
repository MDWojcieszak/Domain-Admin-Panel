import { IsNested, IsNumber } from 'nestjs-swagger-dto';
import { PlaceAiDetailResponseDto } from './place-ai-detail-response.dto';

export class PlaceAiListResponseDto {
  @IsNested({ type: PlaceAiDetailResponseDto, isArray: true })
  places: PlaceAiDetailResponseDto[];

  @IsNumber({ example: 1 })
  total: number;
}
