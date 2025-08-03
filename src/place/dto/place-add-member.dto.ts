import { PlaceMemberRole } from '@prisma/client';
import { IsEnum, IsString } from 'nestjs-swagger-dto';

export class PlaceAddMemberDto {
  @IsString({ description: 'User ID to add as member' })
  userId: string;

  @IsEnum({ enum: { PlaceMemberRole }, optional: true })
  role?: PlaceMemberRole;
}
