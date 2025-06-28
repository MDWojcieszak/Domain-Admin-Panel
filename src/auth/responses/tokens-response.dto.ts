import { IsString } from 'nestjs-swagger-dto';

export class TokensDto {
  @IsString()
  access_token: string;

  @IsString()
  refresh_token: string;
}
