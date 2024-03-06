import { IsString } from 'nestjs-swagger-dto';

export class ProcessMessageDto {
  @IsString()
  id: string;

  @IsString()
  message: string;
}
