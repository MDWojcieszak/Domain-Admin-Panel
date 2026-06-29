import { IsNumber, IsString } from 'nestjs-swagger-dto';

export class ImmichAlbumDeletedResponse {
  /** Internal tracking record (link) id that was removed. */
  @IsString()
  id: string;

  /** How many of the entry's assets were removed from the Immich album. */
  @IsNumber({ type: 'integer' })
  removedAssets: number;
}
