import { IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';
import { ImmichAlbumEntryLinkResponse } from './immich-album-entry-link.response';

/** An Immich album (live) enriched with the photo entries we track for it. */
export class ImmichBrowseAlbumResponse {
  @IsString()
  albumId: string;

  @IsString()
  albumName: string;

  @IsNumber({ type: 'integer' })
  assetCount: number;

  /** Clickable link to the album in the Immich web UI. */
  @IsString()
  albumUrl: string;

  /** Proxy URL for the album cover thumbnail (null when the album is empty). */
  @IsString({ optional: true, nullable: true })
  thumbnailUrl: string | null;

  /** Photo entries we track as contributing to this album. */
  @IsNested({ type: ImmichAlbumEntryLinkResponse, isArray: true })
  entries: ImmichAlbumEntryLinkResponse[];
}
