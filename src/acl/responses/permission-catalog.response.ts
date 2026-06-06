import { IsNested, IsString } from 'nestjs-swagger-dto';

export class PermissionDescriptorResponseDto {
  @IsString()
  key: string;

  @IsString()
  resource: string;

  @IsString()
  description: string;
}

export class PermissionCatalogResponseDto {
  @IsNested({ type: PermissionDescriptorResponseDto, isArray: true })
  permissions: PermissionDescriptorResponseDto[];
}
