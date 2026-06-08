import { AppPlatform } from '@prisma/client';
import {
  IsDate,
  IsEnum,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

/** A device — always the caller's own, so userId is omitted. */
export class DeviceResponse {
  @IsString()
  id: string;

  @IsString()
  installationId: string;

  @IsEnum({ enum: { AppPlatform } })
  platform: AppPlatform;

  @IsString({ optional: true, nullable: true })
  name: string | null;

  @IsDate({ format: 'date-time' })
  activatedAt: Date;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  lastSeenAt: Date | null;

  /** null = active (counts toward the 2-device limit). */
  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  revokedAt: Date | null;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  licenseExpiresAt: Date | null;

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}

export class LicenseResponse {
  /** Compact EdDSA JWS — verify offline against the public key. */
  @IsString()
  license: string;

  @IsDate({ format: 'date-time' })
  expiresAt: Date;
}

export class DeviceWithLicenseResponse {
  @IsNested({ type: DeviceResponse })
  device: DeviceResponse;

  @IsNested({ type: LicenseResponse })
  license: LicenseResponse;
}

export class DeviceListResponse {
  @IsNumber({ type: 'integer' })
  total: number;

  @IsNested({ type: DeviceResponse, isArray: true })
  devices: DeviceResponse[];
}
