import { IsString } from 'nestjs-swagger-dto';

export class BlogColorsResponse {
  @IsString({
    isArray: true,
    description:
      'Allowed inline color tokens (used for both text `fg` and background `bg`).',
  })
  colors: string[];
}
