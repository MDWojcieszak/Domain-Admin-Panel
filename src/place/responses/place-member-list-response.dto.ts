import { IsNested, IsNumber } from 'nestjs-swagger-dto';
import { PlaceMemberResponseDto } from './place-member-response.dto';

export class PlaceMemberListResponseDto {
  @IsNested({ type: PlaceMemberResponseDto, isArray: true })
  members: PlaceMemberResponseDto[];

  @IsNumber({ description: 'Total number of members' })
  total: number;
}
