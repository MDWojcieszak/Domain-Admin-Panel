import { Role, User } from 'prisma/prisma-client';
import { IsEnum, IsString } from 'nestjs-swagger-dto';
export class PatchUserAdminDto {
  @IsString({ isEmail: true, optional: true })
  email?: string;

  @IsEnum({ enum: { Role }, optional: true })
  role?: User['role'];
}
