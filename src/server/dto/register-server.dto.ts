import { IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';

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
