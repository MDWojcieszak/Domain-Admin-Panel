import { IsString } from 'nestjs-swagger-dto';

export class SessionDto {
  @IsString({ optional: true })
  sessionId: string;
}
