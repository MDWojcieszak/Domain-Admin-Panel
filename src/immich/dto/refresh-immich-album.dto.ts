import { IsString } from 'nestjs-swagger-dto';

export class RefreshImmichAlbumDto {
  @IsString()
  photoEntryId: string;
}
