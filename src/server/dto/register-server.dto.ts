import { IsNested, IsString } from 'nestjs-swagger-dto';
import { DiskInfoDto } from './server-properties.dto';
import { IsNumber } from 'class-validator';

class CpuDto {
  @IsNumber()
  cores: number;

  @IsNumber()
  physicalCores: number;
}

export class RegisterServerDto {
  @IsString()
  name: string;

  @IsString()
  ipAddress: string;

  @IsNumber()
  diskCount: number;

  @IsNested({ type: CpuDto })
  cpu: CpuDto;
}
