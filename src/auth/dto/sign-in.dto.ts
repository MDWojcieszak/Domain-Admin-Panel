import { IsString } from 'nestjs-swagger-dto';

export class SignInDto {
  @IsString({ isEmail: true })
  email: string;

  @IsString()
  password: string;
}
