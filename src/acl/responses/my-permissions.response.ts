import { Role } from '@prisma/client';
import { IsBoolean, IsEnum, IsString } from 'nestjs-swagger-dto';

export class MyPermissionsResponseDto {
  @IsEnum({ enum: { Role } })
  role: Role;

  @IsBoolean()
  isOwner: boolean;

  @IsString({ isArray: true })
  permissions: string[];
}
