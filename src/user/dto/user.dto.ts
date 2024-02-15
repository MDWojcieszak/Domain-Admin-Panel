import { Role, User } from 'prisma/prisma-client';
import { IsEnum, IsString } from 'nestjs-swagger-dto';
export class UserDto {
  @IsString({ isEmail: true })
  email: string;

  @IsString()
  password: string;

  @IsEnum({ enum: { Role } })
  role: User['role'];

  @IsString({ optional: true })
  firstName: string;

  @IsString({ optional: true })
  lastName: string;
}
