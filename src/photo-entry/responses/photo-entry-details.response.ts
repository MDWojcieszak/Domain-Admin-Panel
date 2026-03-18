import { IsNested, IsNumber, IsObject } from 'nestjs-swagger-dto';
import { PhotoEntryAstroObjectResponse } from './photo-entry-astro-object.response';
import { PhotoEntryResponse } from './photo-entry.response';

export class PhotoEntryDetailsResponse extends PhotoEntryResponse {
  @IsNested({ type: PhotoEntryAstroObjectResponse, isArray: true })
  astroObjects: PhotoEntryAstroObjectResponse[];

  @IsNumber({ type: 'integer' })
  astroObjectsCount: number;
}
