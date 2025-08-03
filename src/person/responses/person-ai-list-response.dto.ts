import { IsNested, IsNumber } from 'nestjs-swagger-dto';
import { PersonAiDetailResponseDto } from './person-ai-detail-response.dto';

export class PersonAiListResponseDto {
  @IsNested({ type: PersonAiDetailResponseDto, isArray: true })
  persons: PersonAiDetailResponseDto[];

  @IsNumber({ example: 1 })
  total: number;
}
