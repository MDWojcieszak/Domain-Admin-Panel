import { SetMetadata, applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export const PUBLIC_KEY = 'public';
export function Public(...roles: Role[]) {
  return applyDecorators(SetMetadata(PUBLIC_KEY, roles), ApiProperty());
}
