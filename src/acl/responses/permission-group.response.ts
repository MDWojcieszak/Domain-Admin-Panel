import { IsDate, IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';

export class PermissionGroupResponseDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString({ optional: true })
  description?: string;

  @IsString({ isArray: true })
  permissions: string[];

  @IsNumber({ optional: true })
  userCount?: number;

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}

export class PermissionGroupListResponseDto {
  @IsNested({ type: PermissionGroupResponseDto, isArray: true })
  groups: PermissionGroupResponseDto[];

  @IsNumber()
  total: number;
}
