import { IsString } from 'nestjs-swagger-dto';

export class SendCommandDto {
  @IsString()
  serverName: string;
}
