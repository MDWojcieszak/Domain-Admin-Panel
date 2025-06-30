import { IsString } from 'nestjs-swagger-dto';

export class HeartbeatDto {
  @IsString()
  name: string;
}
