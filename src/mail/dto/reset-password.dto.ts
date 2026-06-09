import { IsString } from 'nestjs-swagger-dto';

export class ResetPasswordMailDto {
  @IsString({ isEmail: true })
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  resetLink: string;
}
