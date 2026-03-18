import { IsDate, IsString } from 'nestjs-swagger-dto';

export class PhotoEntryAstroObjectResponse {
  @IsString()
  id: string;

  @IsString()
  astroObjectId: string;

  @IsString({ optional: true, nullable: true })
  rootPath: string | null;

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}
