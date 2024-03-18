import { IsString } from 'nestjs-swagger-dto';

export class RegisterProcessLogDto {
  @IsString()
  processId: string;

  @IsString()
  message: string;
}
