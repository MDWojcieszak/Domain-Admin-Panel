import { IsBoolean, IsString } from 'nestjs-swagger-dto';

export class TestNotificationResultDto {
  @IsBoolean()
  delivered: boolean;

  /** The address the test was sent to (the caller's own email). */
  @IsString()
  email: string;
}
