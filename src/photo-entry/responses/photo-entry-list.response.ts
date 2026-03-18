import { IsNested, IsNumber, IsObject } from 'nestjs-swagger-dto';
import { PhotoEntryResponse } from './photo-entry.response';

export class PhotoEntryListResponse {
  @IsNumber({ type: 'integer' })
  total: number;

  @IsNested({ type: PhotoEntryResponse, isArray: true })
  photoEntries: PhotoEntryResponse[];
}
