import { IsString, IsDate, IsNested, IsEnum } from 'nestjs-swagger-dto';
import { UserResponseDto } from '../../user/responses';
import { PlaceMemberRole } from '@prisma/client';

export class PlaceMemberResponseDto {
  @IsString()
  id: string;

  @IsNested({ type: UserResponseDto })
  user: UserResponseDto;

  @IsDate({ format: 'date-time' })
  joinedAt: Date;

  @IsEnum({ enum: { PlaceMemberRole }, optional: true })
  role?: PlaceMemberRole;
}
