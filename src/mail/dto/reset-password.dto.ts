import { IsString } from 'nestjs-swagger-dto';

export class ResetPasswordDto {
  @IsString({ isEmail: true })
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  resetLink: string;
}
