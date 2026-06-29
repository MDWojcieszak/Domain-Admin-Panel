import { IsNumber, IsString } from 'nestjs-swagger-dto';

export class ImmichAlbumRemovedResponse {
  /** Immich album id that was deleted. */
  @IsString()
  albumId: string;

  /** How many of our tracking links pointed at it and were removed. */
  @IsNumber({ type: 'integer' })
  removedLinks: number;
}
