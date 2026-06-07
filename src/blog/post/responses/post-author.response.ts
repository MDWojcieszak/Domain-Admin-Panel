import { BlogAuthorRole } from '@prisma/client';
import { IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

export class PostAuthorResponse {
  @IsString()
  id: string;

  @IsString()
  userId: string;

  @IsEnum({ enum: { BlogAuthorRole } })
  role: BlogAuthorRole;

  @IsNumber({ type: 'integer' })
  order: number;
}
