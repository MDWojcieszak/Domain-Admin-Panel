import { IsString } from 'nestjs-swagger-dto';

export class DeviceTokenDto {
  @IsString({
    maxLength: 128,
    description: 'The deviceCode returned by /auth/device/authorize',
  })
  deviceCode: string;
}
