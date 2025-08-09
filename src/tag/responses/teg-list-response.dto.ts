import { IsNested, IsNumber } from 'nestjs-swagger-dto';
import { TagDetailResponseDto } from './tag-detail.response';

export class TagListResponseDto {
  @IsNested({ type: TagDetailResponseDto, isArray: true })
  tags: TagDetailResponseDto[];

  @IsNumber()
  total: number;
}
