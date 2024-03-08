import { IsString } from 'nestjs-swagger-dto';

export class ResetPasswordConfirmationDto {
  @IsString({ isEmail: true })
  email: string;

  @IsString()
  firstName: string;
}
