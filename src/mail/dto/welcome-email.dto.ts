import { IsString } from 'nestjs-swagger-dto';

export class WelcomeEmailDto {
  @IsString({ isEmail: true })
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  accessLink: string;
}
