import { IsNested, IsNumber } from 'nestjs-swagger-dto';
import { ImmichLibraryResponse } from './immich-library.response';

export class ImmichLibraryListResponse {
  @IsNumber({ type: 'integer' })
  total: number;

  @IsNested({ type: ImmichLibraryResponse, isArray: true })
  libraries: ImmichLibraryResponse[];
}
