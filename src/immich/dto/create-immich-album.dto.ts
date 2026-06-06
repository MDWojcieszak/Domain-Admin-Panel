import { IsString } from 'nestjs-swagger-dto';

export class CreateImmichAlbumDto {
  @IsString()
  photoEntryId: string;
}
