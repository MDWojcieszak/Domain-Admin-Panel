import { IsNumber, IsString } from 'nestjs-swagger-dto';

export class AstroObjectDetailsResponse {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString({ optional: true })
  code?: string | null;

  @IsString({ optional: true })
  thumbnailUrl?: string | null;

  @IsNumber()
  photoEntriesCount: number;

  @IsString()
  createdAt: Date;

  @IsString()
  updatedAt: Date;
}
