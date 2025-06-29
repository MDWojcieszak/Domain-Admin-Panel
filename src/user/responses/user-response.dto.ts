import { Role } from '@prisma/client';
import { IsDate, IsEnum, IsString } from 'nestjs-swagger-dto';

export class UserResponseDto {
  @IsString()
  id: string;

  @IsString({ isEmail: true })
  email: string;

  @IsString({ optional: true })
  firstName?: string;

  @IsString({ optional: true })
  lastName?: string;

  @IsEnum({ enum: { Role } })
  role: Role;

  @IsDate({ format: 'date-time' })
  createdAt: Date;
}
