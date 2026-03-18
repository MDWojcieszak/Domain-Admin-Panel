import { IsString } from 'nestjs-swagger-dto';

export class AstroObjectResponse {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString({ optional: true })
  code?: string | null;

  @IsString({ optional: true })
  thumbnailUrl?: string | null;

  @IsString()
  createdAt: Date;

  @IsString()
  updatedAt: Date;
}
