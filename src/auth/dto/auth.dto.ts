import { IsString } from 'nestjs-swagger-dto';

export class AuthDto {
  @IsString({ isEmail: true })
  email: string;

  @IsString()
  password: string;

  @IsString()
  platform?: string;

  @IsString({ optional: true })
  browser?: string;

  @IsString({ optional: true })
  os?: string;
}
