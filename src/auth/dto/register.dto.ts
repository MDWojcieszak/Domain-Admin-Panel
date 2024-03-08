import { IsString } from 'nestjs-swagger-dto';

export class RegisterDto {
  @IsString()
  password: string;
}
