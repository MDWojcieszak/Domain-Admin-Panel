import { IsString } from 'nestjs-swagger-dto';

/** Generic in-app notification email (server status, process failure, idle, …). */
export class NotificationMailDto {
  @IsString({ isEmail: true })
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  subject: string;

  /** Highlighted subject (server or process name), e.g. "iceland-box". */
  @IsString()
  subjectName: string;

  /** Phrase after the name, e.g. "went offline unexpectedly". */
  @IsString()
  headline: string;

  /** One-line explanation under the headline. */
  @IsString()
  detail: string;
}
