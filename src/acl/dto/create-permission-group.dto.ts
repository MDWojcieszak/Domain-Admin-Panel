import { IsString } from 'nestjs-swagger-dto';

export class CreatePermissionGroupDto {
  @IsString()
  name: string;

  @IsString({ optional: true })
  description?: string;

  @IsString({ isArray: true, description: 'Permission keys from the catalog' })
  permissions: string[];
}
