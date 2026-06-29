import { IsNumber, IsString } from 'nestjs-swagger-dto';

export class ImmichLibraryResponse {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString({ isArray: true })
  importPaths: string[];

  @IsString({ isArray: true })
  exclusionPatterns: string[];

  @IsNumber({ type: 'integer' })
  assetCount: number;

  @IsString({ optional: true, nullable: true })
  refreshedAt: string | null;

  // Flattened statistics (getLibraryStatistics).
  @IsNumber({ type: 'integer' })
  photos: number;

  @IsNumber({ type: 'integer' })
  videos: number;

  @IsNumber({ type: 'integer' })
  total: number;

  /** Storage usage in bytes. */
  @IsNumber({ type: 'integer' })
  usage: number;
}
