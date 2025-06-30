import { Role } from '@prisma/client';
import { IsEnum, IsString } from 'nestjs-swagger-dto';

export class UserDto {
  @IsString({ isEmail: true })
  email: string;

  @IsString({ optional: true })
  firstName?: string;

  @IsString({ optional: true })
  lastName?: string;

  @IsEnum({ enum: { Role } })
  role: Role;
}
