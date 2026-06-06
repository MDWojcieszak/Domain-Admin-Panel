import { IsString } from 'nestjs-swagger-dto';

export class UpdatePermissionGroupDto {
  @IsString({ optional: true })
  name?: string;

  @IsString({ optional: true })
  description?: string;

  @IsString({
    isArray: true,
    optional: true,
    description: 'Permission keys from the catalog (replaces the existing set)',
  })
  permissions?: string[];
}
