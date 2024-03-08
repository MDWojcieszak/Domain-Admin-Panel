import { IsString } from 'nestjs-swagger-dto';

export class RequestResetPasswordDto {
  @IsString({ isEmail: true })
  email: string;
}
