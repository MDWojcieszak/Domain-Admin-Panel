import { IsString } from 'nestjs-swagger-dto';

export class GetPublicAuthorsQueryDto {
  @IsString({ description: 'Comma-separated user ids (max 100 resolved).' })
  ids: string;
}
