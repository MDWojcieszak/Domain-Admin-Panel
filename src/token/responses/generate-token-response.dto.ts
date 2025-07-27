import { IsDate, IsString } from 'nestjs-swagger-dto';

export class GenerateTokenResponseDto {
  @IsString({ example: 'fa6f0cf5224b...' })
  token: string;

  @IsDate({ format: 'date-time', optional: true })
  expiresAt?: Date;
}
