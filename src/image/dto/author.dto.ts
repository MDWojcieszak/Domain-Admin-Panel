import { IsString } from 'nestjs-swagger-dto';

export class AuthorDto {
  @IsString({ optional: true })
  firstName?: string;

  @IsString({ optional: true })
  lastName?: string;
}
