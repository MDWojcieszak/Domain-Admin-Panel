import { IsString } from 'nestjs-swagger-dto';

export class ServerDto {
  @IsString()
  name: string;

  @IsString()
  ipAddress: string;

  @IsString()
  location: string;
}
